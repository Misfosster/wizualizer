import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { parseDocument } from "../../src/utils/apl-parser/document";
import { validateDocumentSemantics } from "../../src/utils/semantics/validate";
import type { SemanticSpecCatalog } from "../../src/utils/semantics/types";

const CATALOG: SemanticSpecCatalog = {
  actions: ["stormstrike", "lava_lash"],
  buffs: ["hot_hand"],
  debuffs: [],
  cooldowns: ["lava_lash"],
  dots: [],
  talents: ["storm_unleashed"],
  trinkets: [],
  equipped: [],
  setBonuses: [],
  options: [],
};

interface GeneratedSemanticCatalog {
  byClassSpec: Record<string, SemanticSpecCatalog>;
}

function parseOrThrow(text: string) {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(`Parse failed: ${result.error}`);
  }
  return result.document;
}

test("semantic validation accepts known spec atoms and warns on unknown talents", () => {
  const document = parseOrThrow(`
shaman="Enh"
spec=enhancement
actions+=/stormstrike,if=talent.storm_unleashed.enabled&talent.not_real.enabled
`);

  const diagnostics = validateDocumentSemantics(document, () => ({
    status: "loaded",
    catalog: CATALOG,
  }));

  expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
    "Unknown talent 'not_real' for this spec.",
  ]);
});

test("semantic validation keeps local variables and action lists per profile", () => {
  const document = parseOrThrow(`
shaman="Enh"
spec=enhancement
actions+=/variable,name=foo,value=1
actions+=/stormstrike,if=variable.foo
actions+=/call_action_list,name=missing
`);

  const diagnostics = validateDocumentSemantics(document, () => ({
    status: "loaded",
    catalog: CATALOG,
  }));

  expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
    "Unknown action list 'missing' in this profile.",
  ]);
});

test("semantic validation ignores unknown dynamic namespaces", () => {
  const document = parseOrThrow(`
shaman="Enh"
spec=enhancement
actions+=/stormstrike,if=trinket.1.has_use_buff.foo
`);

  const diagnostics = validateDocumentSemantics(document, () => ({
    status: "loaded",
    catalog: CATALOG,
  }));

  expect(diagnostics).toEqual([]);
});

test("semantic validation does not warn for sparse action or aura catalog misses", () => {
  const document = parseOrThrow(`
shaman="Enh"
spec=enhancement
actions+=/voltaic_blaze,if=buff.whirling_earth.up&cooldown.not_cataloged.ready&dot.unknown.ticking
`);

  const diagnostics = validateDocumentSemantics(document, () => ({
    status: "loaded",
    catalog: CATALOG,
  }));

  expect(diagnostics).toEqual([]);
});

test("generated semantic catalogs include SimC metadata atoms", () => {
  const catalog = JSON.parse(
    readFileSync("src/data/semantics/demon_hunter.json", "utf8"),
  ) as GeneratedSemanticCatalog;
  const havoc = catalog.byClassSpec["demon_hunter/havoc"];

  expect(havoc.actions).toContain("eye_beam");
  expect(havoc.buffs).toContain("metamorphosis");
  expect(havoc.debuffs).toContain("essence_break");
  expect(havoc.cooldowns).toContain("eye_beam");
  expect(havoc.dots).toContain("the_hunt");
});
