export interface SemanticSpecCatalog {
  actions: readonly string[];
  buffs: readonly string[];
  debuffs: readonly string[];
  cooldowns: readonly string[];
  dots: readonly string[];
  talents: readonly string[];
  trinkets: readonly string[];
  equipped: readonly string[];
  setBonuses: readonly string[];
  options: readonly string[];
}

export interface SemanticCatalog {
  v: number;
  gameVersion: string;
  byClassSpec: Readonly<Record<string, SemanticSpecCatalog>>;
}

export interface SemanticCatalogLookupResult {
  status: "loaded" | "loading" | "unknown-class" | "unsupported-spec";
  catalog?: SemanticSpecCatalog;
}
