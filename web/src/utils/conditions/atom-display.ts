import type { ConditionAtom } from "./types";

export interface AtomDisplayParts {
  namespace: string;
  namespaceLabel: string;
  subject: string;
  property: string;
  displayKey: string;
}

export interface BooleanOverrideLabels {
  trueLabel: string;
  falseLabel: string;
}

const NAMESPACE_LABELS: Readonly<Record<string, string>> = {
  action: "Actions",
  buff: "Buffs",
  cooldown: "Cooldowns",
  debuff: "Debuffs",
  dot: "Dots",
  equipped: "Equipped",
  pet: "Pets",
  raid_event: "Raid events",
  talent: "Talents",
  target: "Target",
  trinket: "Trinkets",
  variable: "Variables",
};

const COOLDOWN_ACTION_PROPERTIES = new Set(["cooldown", "duration"]);

export function getAtomDisplayParts(atom: ConditionAtom): AtomDisplayParts {
  const { namespace, subject, property } = atom.parts;

  if (namespace === "action" && COOLDOWN_ACTION_PROPERTIES.has(property)) {
    const displayProperty =
      property === "cooldown" ? cooldownStateProperty(atom) : property;
    return buildDisplayParts("cooldown", subject, displayProperty);
  }

  if (namespace === "cooldown" && subject.length > 0 && property.length === 0) {
    return buildDisplayParts("cooldown", subject, cooldownStateProperty(atom));
  }

  return buildDisplayParts(namespace, subject, property);
}

export function getAtomRowLabel(atom: ConditionAtom): string {
  const parts = getAtomDisplayParts(atom);
  if (parts.property.length > 0) {
    return parts.property;
  }
  if (parts.subject.length > 0) {
    return parts.subject;
  }
  return parts.namespace;
}

export function getAtomSearchText(atom: ConditionAtom): string {
  const display = getAtomDisplayParts(atom);
  return `${atom.key} ${display.displayKey}`.toLowerCase();
}

export function getBooleanOverrideLabels(
  atom: ConditionAtom,
): BooleanOverrideLabels {
  const display = getAtomDisplayParts(atom);
  if (display.namespace === "cooldown") {
    if (display.property === "down") {
      return { trueLabel: "Down", falseLabel: "Up" };
    }
    return { trueLabel: "Up", falseLabel: "Down" };
  }
  return { trueLabel: "On", falseLabel: "Off" };
}

function buildDisplayParts(
  namespace: string,
  subject: string,
  property: string,
): AtomDisplayParts {
  return {
    namespace,
    namespaceLabel: NAMESPACE_LABELS[namespace] ?? namespace,
    subject,
    property,
    displayKey: [namespace, subject, property].filter(Boolean).join("."),
  };
}

function cooldownStateProperty(atom: ConditionAtom): string {
  return atom.valueKind === "number" ? "remains" : "up/down";
}
