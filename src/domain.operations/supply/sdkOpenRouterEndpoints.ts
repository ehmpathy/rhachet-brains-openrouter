import {
  withExtendableCacheAsync,
  withSimpleCacheAsync,
} from 'with-simple-cache';
import { z } from 'zod';

import type { OpenRouterCatalogModel } from '../../domain.objects/OpenRouterCatalogModel';
import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asOpenRouterCacheKey } from './asOpenRouterCacheKey';
import { asOpenRouterCatalogModels } from './asOpenRouterCatalogModels';
import { asOpenRouterEndpointCacheKey } from './asOpenRouterEndpointCacheKey';
import { asOpenRouterEndpoints } from './asOpenRouterEndpoints';
import { cacheOpenRouterOnDisk } from './cacheOpenRouterOnDisk';
import { getAllZdrTagsByModel } from './getAllZdrTagsByModel';
import { getOneOpenRouterJson } from './getOneOpenRouterJson';

/**
 * .what = the cache read name for a host that ignored a json schema
 * .why = one name, shared by the read and the write, so the two never drift
 */
const JSON_IGNORED_READ = 'json-ignored';

/**
 * .what = the cache read name, and the shape, of a tier's pick
 * .why = one name and one schema, shared by the read and the write
 */
const TIER_PICK_READ = 'tier-pick';
const SCHEMA_TIER_PICK = z.object({ model: z.string() });

/**
 * .what = the endpoints of one model, memoized 30 min in memory and on disk
 * .why = throughput is openrouter's p50 over the last 30 min, so a fresher read
 *        buys no fresher number; ~46KB per model
 *
 * .note = extendable, so a refused endpoint can drop its model's entry (case=21)
 */
const getAllEndpointsForModel = withExtendableCacheAsync(
  async (input: {
    model: string;
    apiKey: string;
  }): Promise<Omit<OpenRouterEndpoint, 'zdr'>[]> => {
    const body = await getOneOpenRouterJson({
      path: `/models/${input.model}/endpoints`,
      apiKey: input.apiKey,
    });
    return asOpenRouterEndpoints({ body, model: input.model });
  },
  {
    cache: cacheOpenRouterOnDisk,
    expiration: { minutes: 30 },
    serialize: {
      key: (input) =>
        asOpenRouterCacheKey({ read: 'endpoints', model: input.model }),
      value: (output) => JSON.stringify(output),
    },
    deserialize: { value: (cached) => JSON.parse(cached) },
  },
);

/**
 * .what = every model openrouter lists, memoized 60 min in memory and on disk
 * .why = an unlisted slug is checked against the catalog before any spend; a
 *        typo is answered with the nearest ids; a withdrawn model is named as
 *        such. id + date alone, so a warm read is a few kilobytes
 */
const getAllModelsFromCatalog = withSimpleCacheAsync(
  async (input: { apiKey: string }): Promise<OpenRouterCatalogModel[]> => {
    const body = await getOneOpenRouterJson({
      path: '/models',
      apiKey: input.apiKey,
    });
    return asOpenRouterCatalogModels({ body });
  },
  {
    cache: cacheOpenRouterOnDisk,
    expiration: { minutes: 60 },
    serialize: {
      // .note = 'catalog.v2', never 'catalog' nor 'models': an entry from a
      //         prior release, with no `createdAt`, must never deserialize as this shape
      key: () => asOpenRouterCacheKey({ read: 'catalog.v2', model: null }),
      value: (output) => JSON.stringify(output),
    },
    deserialize: { value: (cached) => JSON.parse(cached) },
  },
);

/**
 * .what = the openrouter sdk for supply reads
 * .why = one list per model: each endpoint with its price, speed, params, and
 *        zero-retention membership. openrouter serves the last apart from the
 *        rest; two reads, two caches, one list to the caller
 *
 * .note = a failed read is never cached; the next ask reads again
 * .note = a corrupt cache entry reads as a miss (cacheOpenRouterOnDisk)
 */
export const sdkOpenRouterEndpoints = {
  getAllForModel: async (input: {
    model: string;
    apiKey: string;
  }): Promise<OpenRouterEndpoint[]> => {
    const [endpoints, zdrTagsByModel] = await Promise.all([
      getAllEndpointsForModel.execute(input),
      getAllZdrTagsByModel({ apiKey: input.apiKey }),
    ]);
    const zdrTags = zdrTagsByModel[input.model] ?? [];
    return endpoints.map((endpoint) => ({
      ...endpoint,
      zdr: zdrTags.includes(endpoint.tag),
    }));
  },

  /**
   * .what = drops one model's cached endpoints, so the next read is live
   * .why = an endpoint openrouter refuses as absent proves the cached list
   *        stale; a stale list must not outlive its proof by 30 min (case=21)
   *
   * .note = idempotent: a model with no entry is a no-op
   */
  delForModel: (input: { model: string }): Promise<void> =>
    getAllEndpointsForModel.invalidate({
      forKey: asOpenRouterCacheKey({ read: 'endpoints', model: input.model }),
    }),

  /**
   * .what = the tags, of those given, whose host ignored a json schema on this model
   * .why = a host that answered prose where json was owed is skipped by every
   *        json ask on this machine, for a week, so no ask pays to learn it twice
   *
   * .note = one key per (model, tag): each read is memory-first, and a tag with
   *         no entry, or an expired one, reads as absent
   */
  getAllJsonIgnoredTags: async (input: {
    model: string;
    tags: string[];
  }): Promise<string[]> => {
    const marks = await Promise.all(
      input.tags.map(async (tag) => ({
        tag,
        value: await cacheOpenRouterOnDisk.get(
          asOpenRouterEndpointCacheKey({
            read: JSON_IGNORED_READ,
            model: input.model,
            tag,
          }),
        ),
      })),
    );
    return marks.filter((mark) => mark.value !== undefined).map((m) => m.tag);
  },

  /**
   * .what = records that a host ignored a json schema on this model, for 7 days
   * .why = the record lives in the machine's shared disk cache, so every
   *        process and every repo on this machine skips that host
   *
   * .note = idempotent: a second record of the same pair restarts its 7 days
   */
  setJsonIgnoredTag: (input: { model: string; tag: string }): Promise<void> =>
    cacheOpenRouterOnDisk.set(
      asOpenRouterEndpointCacheKey({
        read: JSON_IGNORED_READ,
        model: input.model,
        tag: input.tag,
      }),
      JSON.stringify({ jsonIgnored: true }),
      { expiration: { days: 7 } },
    ),

  /**
   * .what = the model this machine picked for a tier, if picked within 7 days
   * .why = a tier holds still for a week, so a new release never swaps the
   *        model under a caller mid-task, and the catalog walk runs once a week
   *
   * .note = a tier with no entry, or an expired one, reads as null
   */
  getOneTierPick: async (input: { tier: string }): Promise<string | null> => {
    const cached = await cacheOpenRouterOnDisk.get(
      asOpenRouterCacheKey({ read: TIER_PICK_READ, model: input.tier }),
    );
    if (cached === undefined) return null;
    return SCHEMA_TIER_PICK.parse(JSON.parse(cached)).model;
  },

  /**
   * .what = records the model this machine picked for a tier, for 7 days
   * .why = the record lives in the machine's shared disk cache, so every
   *        process and every repo on this machine reaches the same model
   *
   * .note = idempotent: a second record of the same pick restarts its 7 days
   */
  setOneTierPick: (input: { tier: string; model: string }): Promise<void> =>
    cacheOpenRouterOnDisk.set(
      asOpenRouterCacheKey({ read: TIER_PICK_READ, model: input.tier }),
      JSON.stringify({ model: input.model }),
      { expiration: { days: 7 } },
    ),

  /**
   * .note = the catalog read lives beside the endpoints read: one cache, one
   *         auth path, one failure message
   */
  getAllCatalogModels: (input: {
    apiKey: string;
  }): Promise<OpenRouterCatalogModel[]> => getAllModelsFromCatalog(input),
};

/**
 * .what = the shape of the sdk, for a caller that takes it as context
 * .why = an operation that reads routes declares this dependency, so a test
 *        can pass a fake and the call site shows what it reaches
 */
export type SdkOpenRouterEndpoints = typeof sdkOpenRouterEndpoints;
