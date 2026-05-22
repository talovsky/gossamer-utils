export interface TextRange {
	start: number;
	end: number;
}

export interface TagToken {
	name: string;
	start: number;
	end: number;
	nameRange: TextRange;
	isClosing: boolean;
	isSelfClosing: boolean;
}

const voidHtmlTags = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
]);

export function findMatchingTagOffset(text: string, offset: number): number | undefined {
	const tokens = tokenizeTags(text);
	const activeToken = tokens.find((token) => offset >= token.start && offset <= token.end);

	if (!activeToken || activeToken.isSelfClosing) {
		return undefined;
	}

	const activeIndex = tokens.indexOf(activeToken);
	const matchingToken = activeToken.isClosing
		? findOpeningTag(tokens, activeIndex)
		: findClosingTag(tokens, activeIndex);

	return matchingToken?.nameRange.start;
}

export function isInTagContext(text: string, offset: number): boolean {
	const tokens = tokenizeTags(text);
	const activeTokenIndex = tokens.findIndex((token) => offset >= token.start && offset <= token.end);

	if (activeTokenIndex !== -1) {
		return isActionableTag(tokens, activeTokenIndex);
	}

	return isInsideTagPair(tokens, offset);
}

export function tokenizeTags(text: string): TagToken[] {
	const tokens: TagToken[] = [];
	let index = 0;

	while (index < text.length) {
		const tagStart = text.indexOf('<', index);

		if (tagStart === -1) {
			break;
		}

		const next = text[tagStart + 1];

		if (!next) {
			break;
		}

		if (text.startsWith('<!--', tagStart)) {
			index = skipUntil(text, tagStart + 4, '-->');
			continue;
		}

		if (next === '!' || next === '?') {
			index = skipTagLikeConstruct(text, tagStart + 1);
			continue;
		}

		const token = readTagToken(text, tagStart);

		if (!token) {
			index = tagStart + 1;
			continue;
		}

		tokens.push(token);
		index = token.end + 1;
	}

	return tokens;
}

function readTagToken(text: string, tagStart: number): TagToken | undefined {
	let index = tagStart + 1;
	let isClosing = false;

	if (text[index] === '/') {
		isClosing = true;
		index++;
	}

	index = skipWhitespace(text, index);

	const nameStart = index;

	if (!isNameStart(text[index])) {
		return undefined;
	}

	index++;

	while (isNamePart(text[index])) {
		index++;
	}

	const name = text.slice(nameStart, index);
	const tagEnd = findTagEnd(text, index);

	if (tagEnd === undefined) {
		return undefined;
	}

	const isSelfClosing = !isClosing && (hasSelfClosingSlash(text, index, tagEnd) || voidHtmlTags.has(name.toLowerCase()));

	return {
		name,
		start: tagStart,
		end: tagEnd,
		nameRange: {
			start: nameStart,
			end: index,
		},
		isClosing,
		isSelfClosing,
	};
}

function findClosingTag(tokens: TagToken[], startIndex: number): TagToken | undefined {
	const name = tokens[startIndex].name;
	let depth = 0;

	for (let index = startIndex + 1; index < tokens.length; index++) {
		const token = tokens[index];

		if (token.name !== name || token.isSelfClosing) {
			continue;
		}

		if (token.isClosing) {
			if (depth === 0) {
				return token;
			}

			depth--;
		} else {
			depth++;
		}
	}

	return undefined;
}

function findOpeningTag(tokens: TagToken[], startIndex: number): TagToken | undefined {
	const name = tokens[startIndex].name;
	let depth = 0;

	for (let index = startIndex - 1; index >= 0; index--) {
		const token = tokens[index];

		if (token.name !== name || token.isSelfClosing) {
			continue;
		}

		if (token.isClosing) {
			depth++;
		} else if (depth === 0) {
			return token;
		} else {
			depth--;
		}
	}

	return undefined;
}

function isInsideTagPair(tokens: TagToken[], offset: number): boolean {
	const stack: TagToken[] = [];

	for (const token of tokens) {
		if (token.isSelfClosing) {
			continue;
		}

		if (!token.isClosing) {
			stack.push(token);
			continue;
		}

		for (let stackIndex = stack.length - 1; stackIndex >= 0; stackIndex--) {
			const opening = stack[stackIndex];

			if (opening.name !== token.name) {
				continue;
			}

			stack.splice(stackIndex);

			if (opening.end < offset && offset < token.start) {
				return true;
			}

			break;
		}

		if (token.start > offset) {
			break;
		}
	}

	return false;
}

function isActionableTag(tokens: TagToken[], tokenIndex: number): boolean {
	const token = tokens[tokenIndex];

	if (token.isSelfClosing) {
		return true;
	}

	if (token.isClosing) {
		return findOpeningTag(tokens, tokenIndex) !== undefined;
	}

	return findClosingTag(tokens, tokenIndex) !== undefined;
}

function findTagEnd(text: string, start: number): number | undefined {
	let quote: string | undefined;
	let braceDepth = 0;

	for (let index = start; index < text.length; index++) {
		const char = text[index];

		if (quote) {
			if (char === '\\') {
				index++;
			} else if (char === quote) {
				quote = undefined;
			}

			continue;
		}

		if (char === '"' || char === "'" || char === '`') {
			quote = char;
			continue;
		}

		if (char === '{') {
			braceDepth++;
			continue;
		}

		if (char === '}' && braceDepth > 0) {
			braceDepth--;
			continue;
		}

		if (char === '>' && braceDepth === 0) {
			return index;
		}
	}

	return undefined;
}

function hasSelfClosingSlash(text: string, start: number, end: number): boolean {
	let index = end - 1;

	while (index >= start && /\s/.test(text[index])) {
		index--;
	}

	return text[index] === '/';
}

function skipTagLikeConstruct(text: string, start: number): number {
	const end = findTagEnd(text, start);
	return end === undefined ? text.length : end + 1;
}

function skipUntil(text: string, start: number, terminator: string): number {
	const end = text.indexOf(terminator, start);
	return end === -1 ? text.length : end + terminator.length;
}

function skipWhitespace(text: string, index: number): number {
	while (/\s/.test(text[index])) {
		index++;
	}

	return index;
}

function isNameStart(char: string | undefined): boolean {
	return char !== undefined && /[A-Za-z_$]/.test(char);
}

function isNamePart(char: string | undefined): boolean {
	return char !== undefined && /[\w$.:-]/.test(char);
}
