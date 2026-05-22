export interface TextRange {
	start: number;
	end: number;
}

export interface SvelteBlockToken {
	name: string;
	blockName: string;
	start: number;
	end: number;
	nameRange: TextRange;
	kind: 'open' | 'branch' | 'close';
}

const branchBlockNames = new Map([
	['else', new Set(['if', 'each'])],
	['then', new Set(['await'])],
	['catch', new Set(['await'])],
]);

export function findMatchingSvelteBlockOffset(text: string, offset: number): number | undefined {
	const tokens = tokenizeSvelteBlocks(text);
	const activeIndex = tokens.findIndex((token) => offset >= token.start && offset <= token.end);

	if (activeIndex === -1) {
		return undefined;
	}

	const activeToken = tokens[activeIndex];

	if (activeToken.kind === 'open') {
		return findClosingBlock(tokens, activeIndex)?.nameRange.start;
	}

	if (activeToken.kind === 'close') {
		return findOpeningBlock(tokens, activeIndex)?.nameRange.start;
	}

	return findOpeningBlock(tokens, activeIndex)?.nameRange.start
		?? findClosingBlock(tokens, activeIndex)?.nameRange.start;
}

export function tokenizeSvelteBlocks(text: string): SvelteBlockToken[] {
	const tokenPattern = /\{([#:\/])\s*([A-Za-z][\w-]*)[^}]*\}/g;
	const tokens: SvelteBlockToken[] = [];
	const stack: string[] = [];

	for (const match of text.matchAll(tokenPattern)) {
		const marker = match[1];
		const name = match[2];
		const start = match.index ?? 0;
		const nameStartInMatch = match[0].indexOf(name);
		const nameRange = {
			start: start + nameStartInMatch,
			end: start + nameStartInMatch + name.length,
		};

		if (marker === '#') {
			tokens.push({
				name,
				blockName: name,
				start,
				end: start + match[0].length - 1,
				nameRange,
				kind: 'open',
			});
			stack.push(name);
			continue;
		}

		if (marker === '/') {
			tokens.push({
				name,
				blockName: name,
				start,
				end: start + match[0].length - 1,
				nameRange,
				kind: 'close',
			});
			popMatchingBlock(stack, name);
			continue;
		}

		const blockName = resolveBranchBlockName(stack, name);

		if (!blockName) {
			continue;
		}

		tokens.push({
			name,
			blockName,
			start,
			end: start + match[0].length - 1,
			nameRange,
			kind: 'branch',
		});
	}

	return tokens;
}

function findClosingBlock(tokens: SvelteBlockToken[], startIndex: number): SvelteBlockToken | undefined {
	const blockName = tokens[startIndex].blockName;
	let depth = 0;

	for (let index = startIndex + 1; index < tokens.length; index++) {
		const token = tokens[index];

		if (token.blockName !== blockName) {
			continue;
		}

		if (token.kind === 'open') {
			depth++;
		} else if (token.kind === 'close') {
			if (depth === 0) {
				return token;
			}

			depth--;
		}
	}

	return undefined;
}

function findOpeningBlock(tokens: SvelteBlockToken[], startIndex: number): SvelteBlockToken | undefined {
	const blockName = tokens[startIndex].blockName;
	let depth = 0;

	for (let index = startIndex - 1; index >= 0; index--) {
		const token = tokens[index];

		if (token.blockName !== blockName) {
			continue;
		}

		if (token.kind === 'close') {
			depth++;
		} else if (token.kind === 'open' && depth === 0) {
			return token;
		} else if (token.kind === 'open') {
			depth--;
		}
	}

	return undefined;
}

function resolveBranchBlockName(stack: string[], branchName: string): string | undefined {
	const possibleBlockNames = branchBlockNames.get(branchName);

	if (!possibleBlockNames) {
		return undefined;
	}

	for (let index = stack.length - 1; index >= 0; index--) {
		const blockName = stack[index];

		if (possibleBlockNames.has(blockName)) {
			return blockName;
		}
	}

	return undefined;
}

function popMatchingBlock(stack: string[], blockName: string) {
	const index = stack.lastIndexOf(blockName);

	if (index !== -1) {
		stack.splice(index, 1);
	}
}
