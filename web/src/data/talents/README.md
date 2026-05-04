# Generated talent catalog

This folder is **generated**. Do not hand-edit the JSON files.

Each `<class>.json` file is a legacy `TalentCatalog` for a single class with
one entry per spec in `byClassSpec`. Runtime browser loading uses
`specs/<class>__<spec>.json` so opening one spec does not import the whole
class catalog. `index.json` lists which class slugs have a committed file. See
`web/src/utils/talents/types.ts` for the runtime type; see
`web/scripts/generate-talents/` for the producer.

## Regenerate

```powershell
# Point the script at a local SimulationCraft checkout
$env:SIMC_PATH = "C:\path\to\simc"
cd web
npm run generate:talents

# Or pass the path explicitly
npm run generate:talents -- --simc C:\path\to\simc

# Or point at trait_data.inc directly
npm run generate:talents -- --source C:\path\to\simc\engine\dbc\generated\trait_data.inc
```

The committed catalogs in this folder were produced from SimC's
`midnight` branch reporting WoW build **`12.0.1.66838`**. Regenerate
whenever the live game advances past that build or when SimC pushes a
new `trait_data.inc`.

`streamNodes` inside each spec catalog intentionally contains the full
class-tree import/export order, not just that spec's visible nodes. That
matches Blizzard's `C_Traits.GetTreeNodes(treeID)` behavior, which
serializes all class/spec/hero nodes for the class in ascending
`nodeId` order.

Runtime impact while the catalog is stale: `decode-export.ts` can still
reject talent strings with `unsupported_spec`, `version_mismatch`, or
`malformed_export`, surfacing that state in the Preview panel instead of
silently filtering actions from the graph.

## When to regenerate

- A new talent is added or removed upstream in SimC's `trait_data.inc`.
- Display names change (SimC's `util::tokenize` produces different
  `simcKey`s for different names, so a rename is effectively a new
  talent from our perspective).
- SimC renumbers `id_trait_node_entry` or `id_node`. This is rare but
  happens at major revamps; if export strings stop decoding after a
  content patch, regenerate first.

The generator rewrites every generated `*.json` file in this folder on
each run, so stale class files never linger across regenerations while
this README can stay in place.
