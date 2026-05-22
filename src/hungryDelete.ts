export interface TextRange {
	start: number;
	end: number;
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

function isHorizontalWhitespace(character: string | undefined): boolean {
	return character === ' ' || character === '\t';
}
