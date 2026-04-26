import type { AplDocument } from "@/utils/apl-parser/document";
import { migrateConditionOverridesForDocument } from "@/utils/conditions/profile-scope-migration";
import type { ConditionOverrides } from "@/utils/conditions/types";
import { writeStoredConditionOverrides } from "./storage";

export function migrateStoredOverridesForDocument(
  conditionOverrides: ConditionOverrides,
  document: AplDocument | null,
): ConditionOverrides {
  const migrated = migrateConditionOverridesForDocument(
    conditionOverrides,
    document,
  );
  if (migrated !== conditionOverrides) {
    writeStoredConditionOverrides(migrated);
  }
  return migrated;
}

export function prepareConditionOverridesForDocument(
  conditionOverrides: ConditionOverrides,
  document: AplDocument | null,
): ConditionOverrides {
  const migrated = migrateConditionOverridesForDocument(
    conditionOverrides,
    document,
  );
  writeStoredConditionOverrides(migrated);
  return migrated;
}
