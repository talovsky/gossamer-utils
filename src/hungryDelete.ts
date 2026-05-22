export interface TextRange {
	start: number;
	end: number;
}

export interface TextPosition {
	line: number;
	character: number;
}

export interface TextEditRange {
	start: TextPosition;
	end: TextPosition;
}

export interface HungryBackspaceEdit {
	range: TextEditRange;
	cursor: TextPosition;
}

export function findHungryDeleteRange(lineText: string, position: number): TextRange | undefined {
	if (position === 0) {
		return undefined;
	}

	let start = position;

	while (start > 0 && isHorizontalWhitespace(lineText[start - 1])) {
		start--;
	}

	if (start === position) {
		return undefined;
	}

	return {
		start,
		end: position,
	};
}

export function findHungryBackspaceEdit(
	lineText: string,
	position: number,
	lineNumber: number,
	previousLineText?: string,
): HungryBackspaceEdit | undefined {
	if (position === 0 && lineNumber > 0 && previousLineText !== undefined) {
		if (isWhitespaceOnly(previousLineText)) {
			return {
				range: {
					start: { line: lineNumber - 1, character: 0 },
					end: { line: lineNumber, character: 0 },
				},
				cursor: { line: lineNumber - 1, character: 0 },
			};
		}

		return {
			range: {
				start: { line: lineNumber - 1, character: previousLineText.length },
				end: { line: lineNumber, character: 0 },
			},
			cursor: { line: lineNumber - 1, character: previousLineText.length },
		};
	}

	const range = findHungryDeleteRange(lineText, position);

	if (!range) {
		return undefined;
	}

	if (range.start > 0 || lineNumber === 0 || previousLineText === undefined) {
		return {
			range: {
				start: { line: lineNumber, character: range.start },
				end: { line: lineNumber, character: range.end },
			},
			cursor: { line: lineNumber, character: range.start },
		};
	}

	if (isWhitespaceOnly(previousLineText)) {
		return {
			range: {
				start: { line: lineNumber - 1, character: 0 },
				end: { line: lineNumber, character: 0 },
			},
			cursor: { line: lineNumber - 1, character: position },
		};
	}

	return {
		range: {
			start: { line: lineNumber - 1, character: previousLineText.length },
			end: { line: lineNumber, character: position },
		},
		cursor: { line: lineNumber - 1, character: previousLineText.length },
	};
}

function isHorizontalWhitespace(character: string | undefined): boolean {
	return character === ' ' || character === '\t';
}

function isWhitespaceOnly(text: string): boolean {
	return [...text].every((character) => isHorizontalWhitespace(character));
}
