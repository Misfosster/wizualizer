const CLASS_PROFILE_RE =
  /^(?:warrior|paladin|hunter|rogue|priest|deathknight|death_knight|shaman|mage|warlock|monk|druid|demonhunter|demon_hunter|evoker)=(?:"[^"]*"|[^\s#]+)$/;
const COPY_PROFILE_RE = /^copy=(?:"[^"]*"|[^\s#]+)$/;
const ACTION_LIST_CALL_RE =
  /^\s*actions(?:\.[A-Za-z0-9_.-]+)?(?:=|\+=\/)(?:call_action_list|run_action_list)(?:,|$)/;
const ACTION_LIST_BLOCK_RE =
  /^\s*actions\.([A-Za-z0-9_.-]+)(?:=|\+=\/)/;
const ACTION_LIST_NAME_RE = /(?:^|,)name=([^,\s#]+)/;

export interface ActionListReference {
  name: string;
  lineNumber: number;
  profileIndex: number;
  from: number;
  to: number;
}

export interface ActionListDefinition {
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

function findActionListReferenceInLine(
  line: string,
  lineNumber: number,
  profileIndex: number,
  lineStart: number,
): ActionListReference | null {
  if (!ACTION_LIST_CALL_RE.test(line)) {
    return null;
  }

  const nameMatch = ACTION_LIST_NAME_RE.exec(line);
  const name = nameMatch?.[1];
  if (!nameMatch || !name) {
    return null;
  }

  const valueOffset = nameMatch[0].lastIndexOf(name);
  const from = lineStart + nameMatch.index + valueOffset;
  return {
    name,
    lineNumber,
    profileIndex,
    from,
    to: from + name.length,
  };
}

function findActionListDefinitionInLine(
  line: string,
  lineNumber: number,
  profileIndex: number,
): ActionListDefinition | null {
  const match = ACTION_LIST_BLOCK_RE.exec(line);
  const name = match?.[1];
  return name ? { name, lineNumber, profileIndex } : null;
}

export function findActionListReferences(
  text: string,
): ActionListReference[] {
  const lines = text.split("\n");
  const profileIndexByLine = getProfileIndexByLine(lines);
  const references: ActionListReference[] = [];
  let lineStart = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const reference = findActionListReferenceInLine(
      line,
      index + 1,
      profileIndexByLine[index] ?? 0,
      lineStart,
    );
    if (reference) {
      references.push(reference);
    }

    lineStart += line.length + 1;
  }

  return references;
}

export function findActionListReferenceAtPosition(
  text: string,
  position: number,
): ActionListReference | null {
  for (const reference of findActionListReferences(text)) {
    if (position >= reference.from && position <= reference.to) {
      return reference;
    }
  }

  return null;
}

export function findActionListDefinition(
  text: string,
  reference: ActionListReference,
): ActionListDefinition | null {
  const lines = text.split("\n");
  const profileIndexByLine = getProfileIndexByLine(lines);

  for (let index = 0; index < lines.length; index++) {
    const definition = findActionListDefinitionInLine(
      lines[index] ?? "",
      index + 1,
      profileIndexByLine[index] ?? 0,
    );
    if (
      definition?.name === reference.name &&
      definition.profileIndex === reference.profileIndex
    ) {
      return definition;
    }
  }

  return null;
}
