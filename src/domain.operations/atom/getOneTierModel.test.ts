import { ConstraintError } from 'helpful-errors';
import { asIsoDateStamp, asIsoTimeStamp } from 'iso-time';
import { getError, given, then, useThen, when } from 'test-fns';

import type { OpenRouterCatalogModel } from '../../domain.objects/OpenRouterCatalogModel';
import { getOneTierModel } from './getOneTierModel';

/**
 * .what = one catalog row, by id, age, and withdrawal date
 * .why = the pick reads only these three
 */
const genModel = (input: {
  id: string;
  createdOn: string;
  expiresOn: string | null;
}): OpenRouterCatalogModel => ({
  id: input.id,
  createdAt: asIsoTimeStamp(`${input.createdOn}T00:00:00.000Z`),
  expiresOn: input.expiresOn ? asIsoDateStamp(input.expiresOn) : null,
});

/**
 * .what = a fake sdk: a fixed catalog, and a held-pick store that records writes
 * .why = the pick memory is injected, so a test can see what was held and kept
 */
const genSdk = (input: {
  catalog: OpenRouterCatalogModel[];
  held: string | null;
}) => {
  const writes: { tier: string; model: string }[] = [];
  return {
    writes,
    sdkOpenRouterEndpoints: {
      getAllCatalogModels: async () => input.catalog,
      getOneTierPick: async () => input.held,
      setOneTierPick: async (args: { tier: string; model: string }) => {
        writes.push(args);
      },
    },
  };
};

const CATALOG: OpenRouterCatalogModel[] = [
  genModel({
    id: 'z-ai/glm-5.3-flash',
    createdOn: '2026-08-26',
    expiresOn: null,
  }),
  genModel({
    id: 'z-ai/glm-5.4-flash',
    createdOn: '2026-09-28',
    expiresOn: null,
  }),
  genModel({
    id: 'z-ai/glm-5.2-flash',
    createdOn: '2026-05-01',
    expiresOn: '2026-10-20',
  }),
];

describe('getOneTierModel', () => {
  given('[case1] no pick held on this machine', () => {
    when('[t0] the tier is read', () => {
      const scene = useThen('it picks', async () => {
        const sdk = genSdk({ catalog: CATALOG, held: null });
        const model = await getOneTierModel(
          { tier: 'openrouter/z-ai/flash', apiKey: 'sk-fake' },
          sdk,
        );
        return { model, writes: sdk.writes };
      });

      then('it reaches the newest member of the line', () => {
        expect(scene.model).toEqual('z-ai/glm-5.4-flash');
      });

      then('it holds the pick for the week', () => {
        expect(scene.writes).toEqual([
          { tier: 'openrouter/z-ai/flash', model: 'z-ai/glm-5.4-flash' },
        ]);
      });
    });
  });

  given('[case2] a pick held, still listed and undated', () => {
    // .why = a tier holds still for a week, so a newer release never swaps
    //        the model under a caller mid-task
    when('[t0] the tier is read', () => {
      const scene = useThen('it reads', async () => {
        const sdk = genSdk({ catalog: CATALOG, held: 'z-ai/glm-5.3-flash' });
        const model = await getOneTierModel(
          { tier: 'openrouter/z-ai/flash', apiKey: 'sk-fake' },
          sdk,
        );
        return { model, writes: sdk.writes };
      });

      then('it keeps the held pick, though a newer one is listed', () => {
        expect(scene.model).toEqual('z-ai/glm-5.3-flash');
      });

      then('it writes no new pick', () => {
        expect(scene.writes).toEqual([]);
      });
    });
  });

  given(
    '[case3] a pick held that openrouter has since dated or dropped',
    () => {
      when('[t0] the held pick is dated for withdrawal', () => {
        then('it is discarded, and the tier is picked again', async () => {
          const sdk = genSdk({ catalog: CATALOG, held: 'z-ai/glm-5.2-flash' });
          const model = await getOneTierModel(
            { tier: 'openrouter/z-ai/flash', apiKey: 'sk-fake' },
            sdk,
          );
          expect(model).toEqual('z-ai/glm-5.4-flash');
          expect(sdk.writes).toEqual([
            { tier: 'openrouter/z-ai/flash', model: 'z-ai/glm-5.4-flash' },
          ]);
        });
      });

      when('[t1] the held pick is no longer listed', () => {
        then('it is discarded, and the tier is picked again', async () => {
          const sdk = genSdk({ catalog: CATALOG, held: 'z-ai/glm-5.1-flash' });
          const model = await getOneTierModel(
            { tier: 'openrouter/z-ai/flash', apiKey: 'sk-fake' },
            sdk,
          );
          expect(model).toEqual('z-ai/glm-5.4-flash');
        });
      });
    },
  );

  given('[case4] a catalog with no live member of the line', () => {
    when('[t0] the tier is read', () => {
      then('it is refused before any spend, and names the line', async () => {
        const sdk = genSdk({ catalog: [CATALOG[2]!], held: null });
        const error = await getError(
          getOneTierModel(
            { tier: 'openrouter/z-ai/flash', apiKey: 'sk-fake' },
            sdk,
          ),
        );
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('no call was sent');
        expect(error.message).toMatchSnapshot();
        expect(sdk.writes).toEqual([]);
      });
    });
  });
});
