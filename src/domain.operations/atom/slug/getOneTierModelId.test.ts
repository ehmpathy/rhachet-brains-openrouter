import { asIsoDateStamp, asIsoTimeStamp } from 'iso-time';
import { given, then, when } from 'test-fns';

import type { OpenRouterCatalogModel } from '../../../domain.objects/OpenRouterCatalogModel';
import {
  type BrainAtomSlugOpenRouterBare,
  TIER_BY_BARE_SLUG,
} from './AtomSlug.bare';
import { getOneTierModelId } from './getOneTierModelId';

/**
 * .what = one catalog row, by id and the day openrouter added it
 * .why = the pick reads id, age, and date only
 */
const genModel = (input: {
  id: string;
  createdOn: string;
  expiresOn?: string;
}): OpenRouterCatalogModel => ({
  id: input.id,
  createdAt: asIsoTimeStamp(`${input.createdOn}T00:00:00.000Z`),
  expiresOn: input.expiresOn ? asIsoDateStamp(input.expiresOn) : null,
});

/**
 * .what = a catalog shaped like openrouter's, with every variant a line must skip
 * .why = the lines are strict; each decoy sits one suffix from a real member
 */
const CATALOG: OpenRouterCatalogModel[] = [
  // deepseek: pro and flash lines, one listed id with a dated twin
  genModel({ id: 'deepseek/deepseek-v4-pro', createdOn: '2026-04-23' }),
  genModel({ id: 'deepseek/deepseek-v4-pro-0813', createdOn: '2026-08-13' }),
  genModel({ id: 'deepseek/deepseek-v4-flash', createdOn: '2026-04-23' }),
  genModel({ id: 'deepseek/deepseek-v4.1-flash', createdOn: '2026-09-10' }),
  genModel({
    id: 'deepseek/deepseek-v4.2-flash:free',
    createdOn: '2026-09-30',
  }),
  genModel({ id: 'deepseek/deepseek-v5-pro-preview', createdOn: '2026-09-30' }),
  // kimi: a bare line; a suffixed variant must not match
  genModel({ id: 'moonshotai/kimi-k2.7', createdOn: '2026-05-01' }),
  genModel({ id: 'moonshotai/kimi-k3', createdOn: '2026-07-15' }),
  genModel({ id: 'moonshotai/kimi-k3-turbo', createdOn: '2026-08-01' }),
  // glm: a newer flagship, dated for withdrawal, must be skipped
  genModel({ id: 'z-ai/glm-5.3', createdOn: '2026-08-16' }),
  genModel({
    id: 'z-ai/glm-5.4',
    createdOn: '2026-09-20',
    expiresOn: '2026-10-20',
  }),
  genModel({ id: 'z-ai/glm-5.3-flash', createdOn: '2026-08-26' }),
  genModel({ id: 'z-ai/glm-5.3-air', createdOn: '2026-09-01' }),
];

describe('getOneTierModelId', () => {
  given('[case1] a catalog with members and decoys on each line', () => {
    when('[t0] each tier is picked', () => {
      const TEST_CASES: {
        tier: BrainAtomSlugOpenRouterBare;
        expect: string;
      }[] = [
        {
          tier: 'openrouter/deepseek/pro',
          expect: 'deepseek/deepseek-v4-pro-0813',
        },
        {
          tier: 'openrouter/deepseek/flash',
          expect: 'deepseek/deepseek-v4.1-flash',
        },
        { tier: 'openrouter/moonshotai/pro', expect: 'moonshotai/kimi-k3' },
        { tier: 'openrouter/z-ai/pro', expect: 'z-ai/glm-5.3' },
        { tier: 'openrouter/z-ai/flash', expect: 'z-ai/glm-5.3-flash' },
      ];

      then('each reaches the newest plain, undated member of its line', () => {
        for (const testCase of TEST_CASES)
          expect({
            tier: testCase.tier,
            model: getOneTierModelId({
              tier: TIER_BY_BARE_SLUG[testCase.tier],
              catalog: CATALOG,
            }),
          }).toEqual({ tier: testCase.tier, model: testCase.expect });
      });
    });
  });

  given('[case2] a catalog with no member of the line', () => {
    when('[t0] the tier is picked', () => {
      then('it returns null', () => {
        expect(
          getOneTierModelId({
            tier: TIER_BY_BARE_SLUG['openrouter/z-ai/flash'],
            catalog: [genModel({ id: 'acme/model', createdOn: '2026-01-01' })],
          }),
        ).toEqual(null);
      });
    });
  });

  given('[case3] a pro line and a flash line of one vendor', () => {
    // .why = tier is the axis a caller chose on; a pro line that matched a
    //        flash id would drop the caller a tier with no signal
    when('[t0] each pro line is tested against its flash peer', () => {
      then('no pro line matches a flash id', () => {
        expect(
          TIER_BY_BARE_SLUG['openrouter/deepseek/pro'].line.test(
            'deepseek/deepseek-v4.1-flash',
          ),
        ).toEqual(false);
        expect(
          TIER_BY_BARE_SLUG['openrouter/z-ai/pro'].line.test(
            'z-ai/glm-5.3-flash',
          ),
        ).toEqual(false);
      });
    });
  });
});
