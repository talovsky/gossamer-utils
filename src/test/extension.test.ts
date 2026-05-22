import * as assert from 'assert';
import {
	createArrowToFunctionEdit,
	createFunctionToArrowEdit,
} from '../functionTransform';
import { findHungryDeleteRange } from '../hungryDelete';
import {
	createRenamePlan,
	findHookTuples,
	findIdentifierRanges,
	findTupleAtOffset,
} from '../rename';
import { findMatchingSvelteBlockOffset, tokenizeSvelteBlocks } from '../svelteBlocks';
import { findMatchingTagOffset, isInTagContext, tokenizeTags } from '../tags';
import {
	findReverseTabOutPosition,
	findTabOutPosition,
} from '../tabout';
import {
	wrapSelectionInFragment,
	wrapSelectionInHook,
} from '../wrapSelection';

suite('Hook tuple rename', () => {
	test('finds supported hook tuple declarations', () => {
		const source = [
			'const [count, setCount] = useState(0);',
			'const [name, setName] = React.useState("");',
			'const [open, setOpen] = createSignal(false);',
			'const [ready, setReady] = Solid.createSignal(false);',
		].join('\n');

		assert.deepStrictEqual(findHookTuples(source).map((tuple) => tuple.getter), [
			'count',
			'name',
			'open',
			'ready',
		]);
	});

	test('renames a getter and derives the setter name', () => {
		const source = 'const [count, setCount] = useState(0); count; setCount(1);';
		const offset = source.indexOf('count');
		const tuple = findTupleAtOffset(source, offset);

		assert.ok(tuple);
		assert.deepStrictEqual(createRenamePlan(tuple, offset, 'total'), {
			oldGetter: 'count',
			oldSetter: 'setCount',
			newGetter: 'total',
			newSetter: 'setTotal',
		});
	});

	test('renames a setter and derives the getter name', () => {
		const source = 'const [count, setCount] = React.useState(0); count; setCount(1);';
		const offset = source.indexOf('setCount');
		const tuple = findTupleAtOffset(source, offset);

		assert.ok(tuple);
		assert.deepStrictEqual(createRenamePlan(tuple, offset, 'setTotal'), {
			oldGetter: 'count',
			oldSetter: 'setCount',
			newGetter: 'total',
			newSetter: 'setTotal',
		});
	});

	test('finds identifier references without matching substrings', () => {
		const source = 'count; counter; setCount(); resetCount();';

		assert.deepStrictEqual(findIdentifierRanges(source, 'count'), [
			{ start: 0, end: 5 },
		]);
		assert.deepStrictEqual(findIdentifierRanges(source, 'setCount'), [
			{ start: 16, end: 24 },
		]);
	});
});

suite('Matching tag jump', () => {
	test('finds matching closing tag from opening tag', () => {
		const source = '<section><div className="x">content</div></section>';
		const offset = source.indexOf('div') + 1;
		const target = findMatchingTagOffset(source, offset);

		assert.strictEqual(target, source.lastIndexOf('div'));
	});

	test('finds matching opening tag from closing tag', () => {
		const source = '<section><div>content</div></section>';
		const offset = source.lastIndexOf('div') + 1;
		const target = findMatchingTagOffset(source, offset);

		assert.strictEqual(target, source.indexOf('div'));
	});

	test('handles nested same-name tags', () => {
		const source = '<div><div>inner</div><span /></div>';
		const offset = source.indexOf('div') + 1;
		const target = findMatchingTagOffset(source, offset);

		assert.strictEqual(target, source.lastIndexOf('div'));
	});

	test('ignores self-closing tags', () => {
		const source = '<div><input /><span /></div>';
		const offset = source.indexOf('input') + 1;

		assert.strictEqual(findMatchingTagOffset(source, offset), undefined);
	});

	test('does not treat greater-than signs in quoted attributes as tag endings', () => {
		const source = '<div title="a > b"><span /></div>';
		const tokens = tokenizeTags(source);

		assert.strictEqual(tokens[0].end, source.indexOf('><span'));
		assert.strictEqual(findMatchingTagOffset(source, source.indexOf('div') + 1), source.lastIndexOf('div'));
	});

	test('detects tag context for the remove tag code action', () => {
		const source = '<section><div>content</div></section>';

		assert.strictEqual(isInTagContext(source, source.indexOf('div') + 1), true);
		assert.strictEqual(isInTagContext(source, source.indexOf('content') + 1), true);
		assert.strictEqual(isInTagContext('const value = 1;', 6), false);
	});

	test('does not show tag actions for TypeScript generic-looking expressions', () => {
		assert.strictEqual(isInTagContext('const value = identity<T>(item);', 24), false);
		assert.strictEqual(isInTagContext('const value = <T>item;', 16), false);
	});

	test('shows tag actions for self-closing JSX tags', () => {
		const source = 'return <Component value={item} />;';

		assert.strictEqual(isInTagContext(source, source.indexOf('Component') + 1), true);
	});
});

suite('Matching Svelte block jump', () => {
	test('finds matching closing block from opening each block', () => {
		const source = '{#each items as item}<div>{item}</div>{/each}';
		const offset = source.indexOf('each') + 1;
		const target = findMatchingSvelteBlockOffset(source, offset);

		assert.strictEqual(target, source.lastIndexOf('each'));
	});

	test('finds matching opening block from closing if block', () => {
		const source = '{#if ready}<div />{/if}';
		const offset = source.lastIndexOf('if') + 1;
		const target = findMatchingSvelteBlockOffset(source, offset);

		assert.strictEqual(target, source.indexOf('if'));
	});

	test('handles nested blocks with the same name', () => {
		const source = '{#if a}{#if b}<span />{/if}{/if}';
		const offset = source.indexOf('if') + 1;
		const target = findMatchingSvelteBlockOffset(source, offset);

		assert.strictEqual(target, source.lastIndexOf('if'));
	});

	test('resolves else branches to their enclosing block', () => {
		const source = '{#each items as item}<p />{:else}<span />{/each}';
		const elseOffset = source.indexOf('else') + 1;
		const tokens = tokenizeSvelteBlocks(source);
		const target = findMatchingSvelteBlockOffset(source, elseOffset);

		assert.strictEqual(tokens.find((token) => token.kind === 'branch')?.blockName, 'each');
		assert.strictEqual(target, source.indexOf('each'));
	});

	test('resolves await branches to their enclosing await block', () => {
		const source = '{#await promise}<p />{:then value}<p />{:catch error}<p />{/await}';
		const thenOffset = source.indexOf('then') + 1;
		const catchOffset = source.indexOf('catch') + 1;

		assert.strictEqual(findMatchingSvelteBlockOffset(source, thenOffset), source.indexOf('await'));
		assert.strictEqual(findMatchingSvelteBlockOffset(source, catchOffset), source.indexOf('await'));
	});
});

suite('Function declaration transform', () => {
	test('converts a simple function declaration to an arrow function', () => {
		const source = 'function s() { return 1; }';
		const edit = createFunctionToArrowEdit(source, source.indexOf('s'));

		assert.deepStrictEqual(edit, {
			range: { start: 0, end: source.length },
			replacement: 'const s = () => { return 1; };',
		});
	});

	test('preserves export, async, type parameters, parameters, return type, and body', () => {
		const source = 'export async function load<T>(id: T): Promise<T> { return Promise.resolve(id); }';
		const edit = createFunctionToArrowEdit(source, source.indexOf('load'));

		assert.deepStrictEqual(edit, {
			range: { start: 0, end: source.length },
			replacement: 'export const load = async <T>(id: T): Promise<T> => { return Promise.resolve(id); };',
		});
	});

	test('handles nested braces inside the function body', () => {
		const source = 'function render() { if (ready) { return <div />; } return null; }';
		const edit = createFunctionToArrowEdit(source, source.indexOf('ready'));

		assert.strictEqual(edit?.replacement, 'const render = () => { if (ready) { return <div />; } return null; };');
	});

	test('does not convert when the cursor is outside a function declaration', () => {
		const source = 'const s = () => {}; function t() {}';
		const edit = createFunctionToArrowEdit(source, source.indexOf('s'));

		assert.strictEqual(edit, undefined);
	});
});

suite('Arrow function transform', () => {
	test('converts a simple arrow function declaration to a function declaration', () => {
		const source = 'const s = () => { return 1; };';
		const edit = createArrowToFunctionEdit(source, source.indexOf('s'));

		assert.deepStrictEqual(edit, {
			range: { start: 0, end: source.length },
			replacement: 'function s() { return 1; }',
		});
	});

	test('preserves export, async, type parameters, parameters, return type, and body', () => {
		const source = 'export const load = async <T>(id: T): Promise<T> => { return Promise.resolve(id); };';
		const edit = createArrowToFunctionEdit(source, source.indexOf('load'));

		assert.deepStrictEqual(edit, {
			range: { start: 0, end: source.length },
			replacement: 'export async function load<T>(id: T): Promise<T> { return Promise.resolve(id); }',
		});
	});

	test('does not convert expression-body arrow functions', () => {
		const source = 'const s = () => 1;';
		const edit = createArrowToFunctionEdit(source, source.indexOf('s'));

		assert.strictEqual(edit, undefined);
	});
});

suite('Selection wrappers', () => {
	test('wraps expressions in useMemo', () => {
		assert.strictEqual(wrapSelectionInHook('count + 1', 'useMemo'), 'useMemo(() => count + 1, [])');
	});

	test('wraps callbacks in useCallback without adding another function wrapper', () => {
		assert.strictEqual(wrapSelectionInHook('() => save()', 'useCallback'), 'useCallback(() => save(), [])');
	});

	test('wraps statement selections in a callback block body', () => {
		const selection = 'const increment = () => {\n\tsetSi(si() + 1)\n};';
		const expected = 'useCallback(() => {\nconst increment = () => {\n\tsetSi(si() + 1)\n};\n}, [])';

		assert.strictEqual(wrapSelectionInHook(selection, 'useCallback'), expected);
	});

	test('wraps JSX selections in a fragment', () => {
		assert.strictEqual(wrapSelectionInFragment('<Button />'), '<><Button /></>');
	});

});

suite('TabOut', () => {
	test('jumps over the immediate special character to the right', () => {
		assert.strictEqual(findTabOutPosition('foo(|)', 4), 5);
	});

	test('jumps to the next matching special character after an opener', () => {
		assert.strictEqual(findTabOutPosition('foo(bar)', 4), 7);
	});

	test('does not tab out from leading whitespace', () => {
		assert.strictEqual(findTabOutPosition('  )', 2), undefined);
	});

	test('jumps backward to the previous special character', () => {
		assert.strictEqual(findReverseTabOutPosition('foo(bar)', 7), 3);
	});

	test('supports custom character pairs', () => {
		assert.strictEqual(findTabOutPosition('alpha|beta|', 6, [{ open: '|', close: '|' }]), 10);
	});
});

suite('Hungry Delete', () => {
	test('deletes contiguous spaces before the cursor', () => {
		assert.deepStrictEqual(findHungryDeleteRange('foo   ', 6), { start: 3, end: 6 });
	});

	test('deletes contiguous tabs before the cursor', () => {
		assert.deepStrictEqual(findHungryDeleteRange('foo\t\t', 5), { start: 3, end: 5 });
	});

	test('deletes mixed spaces and tabs before the cursor', () => {
		assert.deepStrictEqual(findHungryDeleteRange('foo \t ', 6), { start: 3, end: 6 });
	});

	test('stops at a non-whitespace character', () => {
		assert.deepStrictEqual(findHungryDeleteRange('foo  bar  ', 10), { start: 8, end: 10 });
	});

	test('does not delete when the previous character is non-whitespace', () => {
		assert.strictEqual(findHungryDeleteRange('foo', 3), undefined);
	});

	test('does not cross line boundaries', () => {
		assert.strictEqual(findHungryDeleteRange('', 0), undefined);
	});
});
