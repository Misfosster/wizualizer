import type { AplDocument, AplProfile } from "@/utils/apl-parser/document";
import type { AplDiagnostic } from "@/utils/apl-parser/diagnostics";
import type { Condition } from "@/utils/apl-parser/types";
import { canonicalAtomKey, parseAtomKey } from "@/utils/conditions/atom-key";
import type {
  SemanticCatalogLookupResult,
  SemanticSpecCatalog,
} from "./types";

export type SemanticCatalogLookup = (
  classSlug: string,
  specSlug: string,
) => SemanticCatalogLookupResult;

interface CatalogSets {
  talents: ReadonlySet<string>;
}

export function validateDocumentSemantics(
  document: AplDocument,
  lookupSpec: SemanticCatalogLookup,
): readonly AplDiagnostic[] {
  const diagnostics: AplDiagnostic[] = [];

  for (const profile of document.profiles) {
    if (!profile.specName) {
      continue;
    }

    const lookup = lookupSpec(profile.className, profile.specName);
    if (lookup.status !== "loaded" || !lookup.catalog) {
      continue;
    }

    diagnostics.push(...validateProfile(profile, lookup.catalog));
  }

  return dedupeDiagnostics(diagnostics);
}

function validateProfile(
  profile: AplProfile,
  catalog: SemanticSpecCatalog,
): readonly AplDiagnostic[] {
  const diagnostics: AplDiagnostic[] = [];
  const catalogSets = createCatalogSets(catalog);
  const localActionLists = new Set(profile.blocks.map((block) => block.name));
  const localVariables = new Set<string>();

  for (const block of profile.blocks) {
    for (const actionLine of block.actions) {
      const { action } = actionLine;
      const variableName = getSegmentValue(actionLine.action.segments, "name");
      if (
        (action.spell === "variable" || action.spell === "cycling_variable") &&
        variableName
      ) {
        localVariables.add(variableName);
      }

      if (
        (action.spell === "call_action_list" ||
          action.spell === "run_action_list") &&
        variableName &&
        !localActionLists.has(`actions.${variableName}`)
      ) {
        diagnostics.push(
          warning(
            actionLine.lineNumber,
            actionLine.rawLine,
            `Unknown action list '${variableName}' in this profile.`,
          ),
        );
      }

      for (const atomKey of collectConditionAtomKeys(actionLine.action.segments)) {
        const atomWarning = validateAtomKey(
          atomKey,
          catalogSets,
          localVariables,
        );
        if (atomWarning) {
          diagnostics.push(
            warning(actionLine.lineNumber, actionLine.rawLine, atomWarning),
          );
        }
      }
    }
  }

  return diagnostics;
}

function validateAtomKey(
  atomKey: string,
  catalog: CatalogSets,
  localVariables: ReadonlySet<string>,
): string | null {
  const parts = parseAtomKey(atomKey);
  const subject = parts.subject;
  if (!subject) {
    return null;
  }

  switch (parts.namespace) {
    case "talent":
      return catalog.talents.has(subject)
        ? null
        : `Unknown talent '${subject}' for this spec.`;
    case "variable":
      return localVariables.has(subject)
        ? null
        : `Unknown variable '${subject}' before this line.`;
    default:
      return null;
  }
}

function createCatalogSets(catalog: SemanticSpecCatalog): CatalogSets {
  return {
    talents: new Set(catalog.talents),
  };
}

function collectConditionAtomKeys(
  segments: readonly { type: string; expr: Condition }[],
): readonly string[] {
  const keys = new Set<string>();
  for (const segment of segments) {
    if (
      segment.type !== "if" &&
      segment.type !== "target_if" &&
      segment.type !== "other"
    ) {
      continue;
    }
    collectAtomKeys(segment.expr, keys);
  }
  return Array.from(keys);
}

function collectAtomKeys(condition: Condition, keys: Set<string>): void {
  switch (condition.kind) {
    case "ident": {
      const key = canonicalAtomKey(condition.name);
      if (key.length > 0) {
        keys.add(key);
      }
      return;
    }
    case "number":
    case "sequence":
      return;
    case "paren":
      collectAtomKeys(condition.expr, keys);
      return;
    case "unary":
      collectAtomKeys(condition.expr, keys);
      return;
    case "binary":
      collectAtomKeys(condition.left, keys);
      collectAtomKeys(condition.right, keys);
      return;
    case "call":
      for (const arg of condition.args) {
        collectAtomKeys(arg, keys);
      }
      return;
  }
}

function getSegmentValue(
  segments: readonly { type: string; key?: string; expr: Condition }[],
  key: string,
): string | null {
  const segment = segments.find(
    (candidate) => candidate.type === "other" && candidate.key === key,
  );
  if (segment?.expr.kind !== "ident") {
    return null;
  }
  return segment.expr.name;
}

function warning(
  lineNumber: number,
  lineText: string,
  message: string,
): AplDiagnostic {
  return {
    code: "semantic_warning",
    message,
    lineNumber,
    lineText,
    severity: "warning",
  };
}

function dedupeDiagnostics(
  diagnostics: readonly AplDiagnostic[],
): readonly AplDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${String(diagnostic.lineNumber)}:${diagnostic.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
