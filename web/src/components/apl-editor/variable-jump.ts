const CLASS_PROFILE_RE =
  /^(?:warrior|paladin|hunter|rogue|priest|deathknight|shaman|mage|warlock|monk|druid|demonhunter|evoker)="[^"]*"$/;
const COPY_PROFILE_RE = /^copy="[^"]*"$/;
const VARIABLE_REFERENCE_RE =
  /variable\.((?:[A-Za-z_][A-Za-z0-9_.-]*|[0-9]+[A-Za-z_][A-Za-z0-9_.-]*))/g;
const VARIABLE_DEFINITION_RE =
  /^\s*actions(?:\.[A-Za-z0-9_.-]+)?(?:=|\+=\/)(?:variable|cycling_variable)(?:,|$)/;
const VARIABLE_NAME_RE = /(?:^|,)name=([^,\s]+)/;

export interface VariableReference {
  name: string;
  lineNumber: number;
  from: number;
  to: number;
}

export interface VariableDefinition {
  name: string;
  lineNumber: number;
  profileIndex: number;
}

function isProfileStart(line: string): boolean {
  const trimmed = line.trim();
  return CLASS_PROFILE_RE.test(trimmed) || COPY_PROFILE_RE.test(trimmed);
}

function getProfileIndexByLine(lines: readonly string[]): number[] {
  const profileIndexByLine: number[] = [];
  let profileIndex = 0;
  let hasProfile = false;

  for (let index = 0; index < lines.length; index++) {
    if (isProfileStart(lines[index] ?? "")) {
      if (hasProfile) {
        profileIndex += 1;
      } else {
        hasProfile = true;
      }
    }

    profileIndexByLine[index] = profileIndex;
  }

  return profileIndexByLine;
}

function findVariableDefinition(
  line: string,
  lineNumber: number,
  profileIndex: number,
): VariableDefinition | null {
  if (!VARIABLE_DEFINITION_RE.test(line)) {
    return null;
  }

  const name = VARIABLE_NAME_RE.exec(line)?.[1];
  if (!name) {
    return null;
  }

  return { name, lineNumber, profileIndex };
}

export function findVariableReferenceAtPosition(
  text: string,
  position: number,
): VariableReference | null {
  for (const reference of findVariableReferences(text)) {
    if (position >= reference.from && position <= reference.to) {
      return reference;
    }
  }

  return null;
}

export function findVariableReferences(text: string): VariableReference[] {
  const lines = text.split("\n");
  const references: VariableReference[] = [];
  let lineStart = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const lineEnd = lineStart + line.length;

    VARIABLE_REFERENCE_RE.lastIndex = 0;
    for (;;) {
      const match = VARIABLE_REFERENCE_RE.exec(line);
      if (!match) {
        break;
      }

      const name = match[1];
      if (name) {
        const from = lineStart + match.index;
        references.push({
          name,
          lineNumber: index + 1,
          from,
          to: from + match[0].length,
        });
      }
    }

    lineStart = lineEnd + 1;
  }

  return references;
}

export function findNearestVariableDefinition(
  text: string,
  variableName: string,
  referenceLineNumber: number,
): VariableDefinition | null {
  const lines = text.split("\n");
  const profileIndexByLine = getProfileIndexByLine(lines);
  const referenceProfileIndex =
    profileIndexByLine[referenceLineNumber - 1] ?? 0;
  let nearestDefinition: VariableDefinition | null = null;

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1;
    if (lineNumber >= referenceLineNumber) {
      break;
    }

    const definition = findVariableDefinition(
      lines[index] ?? "",
      lineNumber,
      profileIndexByLine[index] ?? 0,
    );
    if (
      definition?.name === variableName &&
      definition.profileIndex === referenceProfileIndex
    ) {
      nearestDefinition = definition;
    }
  }

  return nearestDefinition;
}
