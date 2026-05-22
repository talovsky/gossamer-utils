export interface TabOutCharacterSet {
  open: string;
  close: string;
}

export const defaultTabOutCharacterSets: TabOutCharacterSet[] = [
  { open: "[", close: "]" },
  { open: "{", close: "}" },
  { open: "(", close: ")" },
  { open: "'", close: "'" },
  { open: '"', close: '"' },
  { open: ":", close: ":" },
  { open: ",", close: "," },
  { open: "=", close: "=" },
  { open: ">", close: ">" },
  { open: "<", close: "<" },
  { open: ".", close: "." },
  { open: "`", close: "`" },
  { open: ";", close: ";" },
];

export function findTabOutPosition(
  lineText: string,
  position: number,
  characterSets: TabOutCharacterSet[] = defaultTabOutCharacterSets,
): number | undefined {
  if (position === 0 || lineText.slice(0, position).trim() === "") {
    return undefined;
  }

  const currentCharacter = lineText[position];

  if (isTabOutCharacter(currentCharacter, characterSets)) {
    return position + 1;
  }

  const previousCharacter = lineText[position - 1];
  const previousCharacterSet = findCharacterSet(
    previousCharacter,
    characterSets,
  );

  if (!previousCharacterSet) {
    return undefined;
  }

  const nextMatchingCharacter = findNextMatchingCharacter(
    lineText,
    position + 1,
    previousCharacterSet,
  );

  if (nextMatchingCharacter !== undefined) {
    return nextMatchingCharacter;
  }

  const nextSpecialCharacter = findNextSpecialCharacter(
    lineText,
    position + 1,
    characterSets,
  );

  return nextSpecialCharacter;
}

export function findReverseTabOutPosition(
  lineText: string,
  position: number,
  characterSets: TabOutCharacterSet[] = defaultTabOutCharacterSets,
): number | undefined {
  for (let index = position - 1; index >= 0; index--) {
    if (isTabOutCharacter(lineText[index], characterSets)) {
      return index;
    }
  }

  return undefined;
}

function findNextMatchingCharacter(
  lineText: string,
  position: number,
  characterSet: TabOutCharacterSet,
): number | undefined {
  const openIndex = lineText.indexOf(characterSet.open, position);
  const closeIndex = lineText.indexOf(characterSet.close, position);

  if (openIndex === -1 && closeIndex === -1) {
    return undefined;
  }

  if (openIndex === -1) {
    return closeIndex;
  }

  if (closeIndex === -1) {
    return openIndex;
  }

  return Math.min(openIndex, closeIndex);
}

function findNextSpecialCharacter(
  lineText: string,
  position: number,
  characterSets: TabOutCharacterSet[],
): number | undefined {
  for (let index = position; index < lineText.length; index++) {
    if (isTabOutCharacter(lineText[index], characterSets)) {
      return index;
    }
  }

  return undefined;
}

function findCharacterSet(
  character: string | undefined,
  characterSets: TabOutCharacterSet[],
): TabOutCharacterSet | undefined {
  return characterSets.find((characterSet) => {
    return characterSet.open === character || characterSet.close === character;
  });
}

function isTabOutCharacter(
  character: string | undefined,
  characterSets: TabOutCharacterSet[],
): boolean {
  return findCharacterSet(character, characterSets) !== undefined;
}
