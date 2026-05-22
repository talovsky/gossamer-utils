export interface TextRange {
	start: number;
	end: number;
}

export interface FunctionToArrowEdit {
	range: TextRange;
	replacement: string;
}

export interface ArrowToFunctionEdit {
	range: TextRange;
	replacement: string;
}

const functionDeclarationPattern =
	/(^|[;\n\r])(\s*)(export\s+)?(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*/g;
const arrowFunctionPattern =
	/(^|[;\n\r])(\s*)(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*/g;

export function createFunctionToArrowEdit(text: string, offset: number): FunctionToArrowEdit | undefined {
	for (const match of text.matchAll(functionDeclarationPattern)) {
		const declarationStart = (match.index ?? 0) + match[1].length;
		const leadingWhitespace = match[2];
		const exportPrefix = match[3] ?? '';
		const asyncPrefix = match[4] ? 'async ' : '';
		const name = match[5];
		let index = (match.index ?? 0) + match[0].lastIndexOf(name) + name.length;

		index = skipWhitespace(text, index);

		const typeParameters = text[index] === '<'
			? readBalanced(text, index, '<', '>')
			: undefined;

		if (typeParameters) {
			index = typeParameters.end;
			index = skipWhitespace(text, index);
		}

		if (text[index] !== '(') {
			continue;
		}

		const parameters = readBalanced(text, index, '(', ')');

		if (!parameters) {
			continue;
		}

		index = skipWhitespace(text, parameters.end);

		const bodyStart = findBodyStart(text, index);

		if (bodyStart === undefined) {
			continue;
		}

		const returnType = text.slice(index, bodyStart).trimEnd();
		const body = readBalanced(text, bodyStart, '{', '}');

		if (!body) {
			continue;
		}

		if (offset < declarationStart || offset > body.end) {
			continue;
		}

		const arrowPrefix = asyncPrefix + (typeParameters?.text ?? '');
		const arrowHead = arrowPrefix.length > 0 ? `${arrowPrefix}${parameters.text}` : parameters.text;
		const replacement = `${leadingWhitespace}${exportPrefix}const ${name} = ${arrowHead}${returnType} => ${body.text};`;

		return {
			range: {
				start: declarationStart,
				end: body.end,
			},
			replacement,
		};
	}

	return undefined;
}

export function createArrowToFunctionEdit(text: string, offset: number): ArrowToFunctionEdit | undefined {
	for (const match of text.matchAll(arrowFunctionPattern)) {
		const declarationStart = (match.index ?? 0) + match[1].length;
		const leadingWhitespace = match[2];
		const exportPrefix = match[3] ?? '';
		const name = match[4];
		let index = (match.index ?? 0) + match[0].length;
		index = skipWhitespace(text, index);

		const isAsync = text.startsWith('async', index) && !isNamePart(text[index + 'async'.length]);

		if (isAsync) {
			index += 'async'.length;
			index = skipWhitespace(text, index);
		}

		const typeParameters = text[index] === '<'
			? readBalanced(text, index, '<', '>')
			: undefined;

		if (typeParameters) {
			index = typeParameters.end;
			index = skipWhitespace(text, index);
		}

		if (text[index] !== '(') {
			continue;
		}

		const parameters = readBalanced(text, index, '(', ')');

		if (!parameters) {
			continue;
		}

		index = skipWhitespace(text, parameters.end);

		const arrowIndex = text.indexOf('=>', index);

		if (arrowIndex === -1 || text.slice(index, arrowIndex).includes('\n')) {
			continue;
		}

		const returnType = text.slice(index, arrowIndex).trimEnd();
		index = skipWhitespace(text, arrowIndex + '=>'.length);

		if (text[index] !== '{') {
			continue;
		}

		const body = readBalanced(text, index, '{', '}');

		if (!body) {
			continue;
		}

		let declarationEnd = body.end;

		if (text[declarationEnd] === ';') {
			declarationEnd++;
		}

		if (offset < declarationStart || offset > declarationEnd) {
			continue;
		}

		const asyncPrefix = isAsync ? 'async ' : '';
		const typeParameterText = typeParameters?.text ?? '';
		const replacement = `${leadingWhitespace}${exportPrefix}${asyncPrefix}function ${name}${typeParameterText}${parameters.text}${returnType} ${body.text}`;

		return {
			range: {
				start: declarationStart,
				end: declarationEnd,
			},
			replacement,
		};
	}

	return undefined;
}

function findBodyStart(text: string, start: number): number | undefined {
	let quote: string | undefined;

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
			return index;
		}

		if (char === ';' || char === '\n' || char === '\r') {
			return undefined;
		}
	}

	return undefined;
}

function readBalanced(
	text: string,
	start: number,
	open: string,
	close: string,
): { text: string; end: number } | undefined {
	let quote: string | undefined;
	let depth = 0;

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

		if (char === open) {
			depth++;
			continue;
		}

		if (char === close) {
			depth--;

			if (depth === 0) {
				return {
					text: text.slice(start, index + 1),
					end: index + 1,
				};
			}
		}
	}

	return undefined;
}

function skipWhitespace(text: string, index: number): number {
	while (/\s/.test(text[index])) {
		index++;
	}

	return index;
}

function isNamePart(char: string | undefined): boolean {
	return char !== undefined && /[\w$]/.test(char);
}
