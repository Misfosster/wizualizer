import { parseConditionFromText } from "./parser";
import type {
  ActionParsed,
  ActionInterpreted,
  Schema,
  OptionSchema,
  ParsedValue,
  SegmentInterpreted,
  Diagnostic,
  ListItem,
} from "./types";

// default schema - only if/target_if are expressions
export const DEFAULT_SCHEMA: Schema = {
  defaults: {
    options: {
      if: { kind: "expr" },
      target_if: { kind: "expr" },
    },
  },
};

interface ParseIssue {
  level: "error" | "warning";
  message: string;
}

// apply schema - interpret raw segments and collect diagnostics
export function applySchema(
  action: ActionParsed,
  schema: Schema = DEFAULT_SCHEMA,
): ActionInterpreted {
  const diagnostics: Diagnostic[] = [];
  // merge defaults - action-specific overrides
  const actionSchema = schema.actions?.[action.spell] ?? {};
  const mergedOptions = {
    ...(schema.defaults?.options ?? {}),
    ...(actionSchema.options ?? {}),
  };
  const positionalSchema = actionSchema.positional ?? schema.defaults?.positional;

  const segments: SegmentInterpreted[] = action.segments.map((segment, index) => {
    if (segment.kind === "arg") {
      const optionSchema = mergedOptions[segment.key];
      const { value, issues } = parseValue(segment.valueRaw, optionSchema);
      for (const issue of issues) {
        diagnostics.push({
          level: issue.level,
          message: issue.message,
          segmentIndex: index,
          key: segment.key,
        });
      }
      return {
        kind: "arg",
        key: segment.key,
        value,
        valueRaw: segment.valueRaw,
      };
    }

    const { value, issues } = parseValue(segment.valueRaw, positionalSchema);
    for (const issue of issues) {
      diagnostics.push({
        level: issue.level,
        message: issue.message,
        segmentIndex: index,
      });
    }
    return {
      kind: "positional",
      value,
      valueRaw: segment.valueRaw,
    };
  });

  for (const [key, option] of Object.entries(mergedOptions)) {
    if (!option.required) continue;
    const hasKey = segments.some(
      (segment) => segment.kind === "arg" && segment.key === key,
    );
    if (!hasKey) {
      diagnostics.push({
        level: "error",
        message: `Missing required option: ${key}`,
        key,
      });
    }
  }

  return {
    category: action.category,
    spell: action.spell,
    op: action.op,
    segments,
    diagnostics,
  };
}

// parse value - apply option schema
function parseValue(
  raw: string,
  schema?: OptionSchema,
): { value: ParsedValue; issues: ParseIssue[] } {
  const issues: ParseIssue[] = [];

  if (!schema) {
    return { value: { kind: "raw", value: raw }, issues };
  }

  if (raw.length === 0) {
    issues.push({ level: "error", message: "Missing value" });
    return { value: { kind: "raw", value: raw }, issues };
  }

  switch (schema.kind) {
    case "expr": {
      try {
        const expr = parseConditionFromText(raw);
        return { value: { kind: "expr", expr }, issues };
      } catch (error) {
        issues.push({
          level: "error",
          message: error instanceof Error ? error.message : String(error),
        });
        return { value: { kind: "raw", value: raw }, issues };
      }
    }
    case "number": {
      const num = Number(raw);
      if (Number.isNaN(num)) {
        issues.push({
          level: "error",
          message: `Invalid number: ${raw}`,
        });
        return { value: { kind: "raw", value: raw }, issues };
      }
      return { value: { kind: "number", value: num }, issues };
    }
    case "enum": {
      if (schema.allowed && !schema.allowed.includes(raw)) {
        issues.push({
          level: "warning",
          message: `Unexpected value: ${raw}`,
        });
      }
      return { value: { kind: "enum", value: raw }, issues };
    }
    case "list": {
      const { items, issues: listIssues } = parseList(raw, schema);
      issues.push(...listIssues);
      return { value: { kind: "list", items }, issues };
    }
    case "string":
    default:
      return { value: { kind: "string", value: raw }, issues };
  }
}

// parse list - split and coerce numbers
function parseList(
  raw: string,
  schema: OptionSchema,
): { items: ListItem[]; issues: ParseIssue[] } {
  const issues: ParseIssue[] = [];
  const delimiter = schema.delimiter ?? "/";
  const parts = raw.split(delimiter).map((part) => part.trim());
  const items: ListItem[] = [];

  for (const part of parts) {
    if (part.length === 0) {
      continue;
    }
    if (schema.itemKind === "number") {
      const num = Number(part);
      if (Number.isNaN(num)) {
        issues.push({
          level: "error",
          message: `Invalid number: ${part}`,
        });
        continue;
      }
      items.push(num);
      continue;
    }
    items.push(part);
  }

  return { items, issues };
}
