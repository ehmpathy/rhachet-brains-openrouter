import type { IsoDateStamp, IsoTimeStamp } from 'iso-time';

/**
 * .what = one model openrouter lists: its id, when it was added, and the date it withdraws it, if any
 * .why = openrouter publishes each deprecation as `expiration_date` on `/models`;
 *        that date, not a hand-kept map, is the record of a retirement (F23).
 *        `createdAt` orders a model line, so a tier reaches its newest member
 */
export type OpenRouterCatalogModel = {
  id: string;
  createdAt: IsoTimeStamp;
  expiresOn: IsoDateStamp | null;
};
