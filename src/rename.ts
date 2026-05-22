export interface TextRange {
	start: number;
	end: number;
}

export interface HookTuple {
	getter: string;
	setter: string;
	getterRange: TextRange;
	setterRange: TextRange;
}

export interface RenamePlan {
	oldGetter: string;
	oldSetter: string;
	newGetter: string;
	newSetter: string;
}

const hookTuplePattern =
	/\bconst\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*(?:(React|Solid)\s*\.\s*)?(useState|createSignal)\s*\(/g;

const supportedHooks = new Set([
	'useState',
	'React.useState',
	'createSignal',
	'Solid.createSignal',
]);

export function findHookTuples(text: string): HookTuple[] {
	const tuples: HookTuple[] = [];

	for (const match of text.matchAll(hookTuplePattern)) {
		const namespace = match[3];
		const hookName = match[4];
		const callee = namespace ? `${namespace}.${hookName}` : hookName;

		if (!supportedHooks.has(callee)) {
			continue;
		}

		const fullMatch = match[0];
		const getter = match[1];
		const setter = match[2];
		const matchStart = match.index ?? 0;
		const getterIndex = fullMatch.indexOf(getter);
		const setterIndex = fullMatch.indexOf(setter, getterIndex + getter.length);

		tuples.push({
			getter,
			setter,
			getterRange: {
				start: matchStart + getterIndex,
				end: matchStart + getterIndex + getter.length,
			},
			setterRange: {
				start: matchStart + setterIndex,
				end: matchStart + setterIndex + setter.length,
			},
		});
	}

	return tuples;
}

export function findTupleAtOffset(text: string, offset: number): HookTuple | undefined {
	return findHookTuples(text).find((tuple) => {
		return containsOffset(tuple.getterRange, offset) || containsOffset(tuple.setterRange, offset);
	});
}

export function createRenamePlan(tuple: HookTuple, offset: number, newName: string): RenamePlan | undefined {
	const isGetterRename = containsOffset(tuple.getterRange, offset);
	const isSetterRename = containsOffset(tuple.setterRange, offset);

	if (!isGetterRename && !isSetterRename) {
		return undefined;
	}

	if (isGetterRename) {
		return {
			oldGetter: tuple.getter,
			oldSetter: tuple.setter,
			newGetter: newName,
			newSetter: setterNameFor(newName),
		};
	}

	const getterName = getterNameFor(newName);

	return {
		oldGetter: tuple.getter,
		oldSetter: tuple.setter,
		newGetter: getterName,
		newSetter: setterNameFor(getterName),
	};
}

export function findIdentifierRanges(text: string, identifier: string): TextRange[] {
	const escapedIdentifier = escapeRegExp(identifier);
	const identifierPattern = new RegExp(`(?<![\\w$])${escapedIdentifier}(?![\\w$])`, 'g');
	const ranges: TextRange[] = [];

	for (const match of text.matchAll(identifierPattern)) {
		const start = match.index ?? 0;
		ranges.push({
			start,
			end: start + identifier.length,
		});
	}

	return ranges;
}

function containsOffset(range: TextRange, offset: number): boolean {
	return offset >= range.start && offset <= range.end;
}

function setterNameFor(getterName: string): string {
	if (getterName.length === 0) {
		return 'set';
	}

	return `set${getterName[0].toUpperCase()}${getterName.slice(1)}`;
}

function getterNameFor(setterName: string): string {
	if (!/^set[A-Z]/.test(setterName)) {
		return setterName;
	}

	const nameWithoutPrefix = setterName.slice(3);

	if (nameWithoutPrefix.length === 0) {
		return setterName;
	}

	return `${nameWithoutPrefix[0].toLowerCase()}${nameWithoutPrefix.slice(1)}`;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
