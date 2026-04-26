# Semantic Catalog Source

This folder holds committed source snapshots for the browser-only APL semantic catalog.

`metadata.json` is a compact snapshot extracted from SimulationCraft engine class-module sources. It is the primary source for class-level metadata such as actions, buffs, debuffs, cooldowns, and dots.

`corpus.json` is intentionally small in this foundation pass. It remains available for curated additions and edge cases that the metadata extractor cannot infer.

Run `npm run fetch:semantics-source` from `web/` to refresh `metadata.json` from SimulationCraft, then run `npm run generate:semantics` to rebuild the runtime JSON catalogs in `src/data/semantics/`.
