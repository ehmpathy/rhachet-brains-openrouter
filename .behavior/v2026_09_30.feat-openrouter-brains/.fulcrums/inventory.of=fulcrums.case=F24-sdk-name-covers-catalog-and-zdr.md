# F24 — `sdkOpenRouterEndpoints` now covers three reads, and its name names one

- **fork**: (a) keep `sdkOpenRouterEndpoints` · (b) rename to `sdkOpenRouter`, with its file and
  its integration test
- **taken**: (a), for now.
  - the sdk holds three reads: endpoints per model, the zdr list, and the model catalog (with
    `expiresOn`, F23). "Endpoints" names the first alone, so a reader who seeks the catalog read
    does not look here
  - (b) is the truer name. but it touches 88 lines across `src/`, moves two files, and changes a
    path that the reviewed vision yield, F19, and a vision self review cite as evidence. those
    citations record where the code lived when it was checked; a rewrite of them would blur that
  - the endpoints read is still the sdk's main job. the `getAllCatalogModels` member carries a
    note on why it lives beside the endpoints read
- **rework**: clean — a mechanical rename (`sedreplace` + `mvsafe`), no contract change. the sdk
  is not exported, so no consumer sees the name.
- **confidence**: 70% — a name that understates its scope is a real cost; the case for (a) is only
  that the ripple lands in reviewed artifacts.
- **where**: `src/domain.operations/route/sdkOpenRouterEndpoints.ts` and its callers.
- **verdict**: —
