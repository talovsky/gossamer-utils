import * as vscode from 'vscode';
import {
	createArrowToFunctionEdit,
	createFunctionToArrowEdit,
} from './functionTransform';
import { findHungryDeleteRange } from './hungryDelete';
import {
	createRenamePlan,
	findIdentifierRanges,
	findTupleAtOffset,
} from './rename';
import { findMatchingSvelteBlockOffset } from './svelteBlocks';
import { isInTagContext } from './tags';
import {
	wrapSelectionInFragment,
	wrapSelectionInHook,
} from './wrapSelection';
import {
	defaultTabOutCharacterSets,
	findReverseTabOutPosition,
	findTabOutPosition,
	TabOutCharacterSet,
} from './tabout';

const supportedLanguages = [
	'javascript',
	'javascriptreact',
	'typescript',
	'typescriptreact',
];

const scriptActionLanguages = [
	'javascript',
	'javascriptreact',
	'typescript',
	'typescriptreact',
];

const tagLanguages = new Set([
	'astro',
	'html',
	'javascript',
	'javascriptreact',
	'svelte',
	'typescript',
	'typescriptreact',
	'vue',
]);

const tagActionLanguages = [
	'astro',
	'html',
	'javascript',
	'javascriptreact',
	'svelte',
	'typescript',
	'typescriptreact',
	'vue',
];

const fragmentActionLanguages = new Set([
	'javascriptreact',
	'typescriptreact',
]);

type FrameworkMode = 'react' | 'solid';

export function activate(context: vscode.ExtensionContext) {
	const selector = supportedLanguages.map((language) => ({ language }));
	const provider: vscode.RenameProvider = {
		prepareRename(document, position) {
			const text = document.getText();
			const offset = document.offsetAt(position);
			const tuple = findTupleAtOffset(text, offset);

			if (!tuple) {
				return undefined;
			}

			const activeRange = offset >= tuple.getterRange.start && offset <= tuple.getterRange.end
				? tuple.getterRange
				: tuple.setterRange;

			return new vscode.Range(
				document.positionAt(activeRange.start),
				document.positionAt(activeRange.end),
			);
		},

		provideRenameEdits(document, position, newName) {
			const text = document.getText();
			const offset = document.offsetAt(position);
			const tuple = findTupleAtOffset(text, offset);

			if (!tuple) {
				return undefined;
			}

			const plan = createRenamePlan(tuple, offset, newName);

			if (!plan) {
				return undefined;
			}

			const edit = new vscode.WorkspaceEdit();
			addIdentifierReplacements(document, edit, plan.oldGetter, plan.newGetter);
			addIdentifierReplacements(document, edit, plan.oldSetter, plan.newSetter);

			return edit;
		},
	};

	context.subscriptions.push(
		vscode.languages.registerRenameProvider(selector, provider),
		vscode.languages.registerCodeActionsProvider(
			tagActionLanguages.map((language) => ({ language })),
			new TagCodeActionProvider(),
			{ providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
		),
		vscode.languages.registerCodeActionsProvider(
			scriptActionLanguages.map((language) => ({ language })),
			new ScriptCodeActionProvider(),
			{ providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
		),
		vscode.commands.registerCommand('reactify.jumpToMatchingBracketOrTag', jumpToMatchingBracketOrTag),
		vscode.commands.registerCommand('reactify.jumpToMatchingTag', jumpToMatchingTag),
		vscode.commands.registerCommand('reactify.removeTagPreserveChildren', removeTagPreserveChildren),
		vscode.commands.registerCommand('reactify.balanceTagInward', balanceTagInward),
		vscode.commands.registerCommand('reactify.balanceTagOutward', balanceTagOutward),
		vscode.commands.registerCommand('reactify.renameSymbol', renameSymbol),
		vscode.commands.registerCommand('reactify.goToDefinition', goToDefinition),
		vscode.commands.registerCommand('reactify.convertFunctionToArrow', convertFunctionToArrow),
		vscode.commands.registerCommand('reactify.convertArrowToFunction', convertArrowToFunction),
		vscode.commands.registerCommand('reactify.wrapSelectionWithTag', wrapSelectionWithTag),
		vscode.commands.registerCommand('reactify.wrapSelectionInUseMemo', () => wrapActiveSelectionInHook('useMemo')),
		vscode.commands.registerCommand('reactify.wrapSelectionInUseCallback', () => wrapActiveSelectionInHook('useCallback')),
		vscode.commands.registerCommand('reactify.wrapSelectionInFragment', wrapActiveSelectionInFragment),
		vscode.commands.registerCommand('reactify.tabout', tabOut),
		vscode.commands.registerCommand('reactify.taboutReverse', tabOutReverse),
		vscode.commands.registerCommand('reactify.toggleTabOut', toggleTabOut),
		vscode.commands.registerCommand('reactify.hungryDelete', hungryDelete),
	);
}

export function deactivate() {}

function addIdentifierReplacements(
	document: vscode.TextDocument,
	edit: vscode.WorkspaceEdit,
	oldName: string,
	newName: string,
) {
	for (const range of findIdentifierRanges(document.getText(), oldName)) {
		edit.replace(
			document.uri,
			new vscode.Range(document.positionAt(range.start), document.positionAt(range.end)),
			newName,
		);
	}
}

async function jumpToMatchingBracketOrTag() {
	const editor = vscode.window.activeTextEditor;

	if (!editor || !tagLanguages.has(editor.document.languageId)) {
		await vscode.commands.executeCommand('editor.action.jumpToBracket');
		return;
	}

	const text = editor.document.getText();
	const offset = editor.document.offsetAt(editor.selection.active);

	if (editor.document.languageId === 'svelte') {
		const matchingOffset = findMatchingSvelteBlockOffset(text, offset);

		if (matchingOffset !== undefined) {
			const position = editor.document.positionAt(matchingOffset);
			editor.selection = new vscode.Selection(position, position);
			editor.revealRange(new vscode.Range(position, position));
			return;
		}
	}

	if (isInTagContext(text, offset)) {
		await jumpToMatchingTag();
		return;
	}

	await vscode.commands.executeCommand('editor.action.jumpToBracket');
}

async function jumpToMatchingTag() {
	await vscode.commands.executeCommand('editor.emmet.action.matchTag');
}

async function removeTagPreserveChildren() {
	await vscode.commands.executeCommand('editor.emmet.action.removeTag');
}

async function balanceTagInward() {
	await vscode.commands.executeCommand('editor.emmet.action.balanceIn');
}

async function balanceTagOutward() {
	await vscode.commands.executeCommand('editor.emmet.action.balanceOut');
}

async function renameSymbol() {
	await vscode.commands.executeCommand('editor.action.rename');
}

async function goToDefinition() {
	await vscode.commands.executeCommand('editor.action.revealDefinition');
}

async function convertFunctionToArrow() {
	const editor = vscode.window.activeTextEditor;

	if (!editor) {
		return;
	}

	const offset = editor.document.offsetAt(editor.selection.active);
	const edit = createFunctionToArrowEdit(editor.document.getText(), offset);

	if (!edit) {
		return;
	}

	await editor.edit((builder) => {
		builder.replace(
			new vscode.Range(
				editor.document.positionAt(edit.range.start),
				editor.document.positionAt(edit.range.end),
			),
			edit.replacement,
		);
	});
}

async function convertArrowToFunction() {
	const editor = vscode.window.activeTextEditor;

	if (!editor) {
		return;
	}

	const offset = editor.document.offsetAt(editor.selection.active);
	const edit = createArrowToFunctionEdit(editor.document.getText(), offset);

	if (!edit) {
		return;
	}

	await editor.edit((builder) => {
		builder.replace(
			new vscode.Range(
				editor.document.positionAt(edit.range.start),
				editor.document.positionAt(edit.range.end),
			),
			edit.replacement,
		);
	});
}

async function wrapSelectionWithTag() {
	await vscode.commands.executeCommand('editor.emmet.action.wrapWithAbbreviation');
}

async function wrapActiveSelectionInHook(wrapper: 'useMemo' | 'useCallback') {
	const editor = vscode.window.activeTextEditor;

	if (!editor || editor.selection.isEmpty) {
		return;
	}

	const selectedText = editor.document.getText(editor.selection);

	await editor.edit((builder) => {
		builder.replace(editor.selection, wrapSelectionInHook(selectedText, wrapper));
	});
}

async function wrapActiveSelectionInFragment() {
	const editor = vscode.window.activeTextEditor;

	if (!editor || editor.selection.isEmpty) {
		return;
	}

	await editor.edit((builder) => {
		builder.replace(editor.selection, wrapSelectionInFragment(editor.document.getText(editor.selection)));
	});
}

async function tabOut() {
	const editor = vscode.window.activeTextEditor;

	if (!editor || !isTabOutEnabled()) {
		await vscode.commands.executeCommand('tab');
		return;
	}

	const nextSelections = editor.selections.map((selection) => {
		if (!selection.isEmpty) {
			return undefined;
		}

		const lineText = editor.document.lineAt(selection.active.line).text;
		const nextCharacter = findTabOutPosition(lineText, selection.active.character, getTabOutCharacterSets());

		if (nextCharacter === undefined) {
			return undefined;
		}

		const position = new vscode.Position(selection.active.line, nextCharacter);
		return new vscode.Selection(position, position);
	});

	if (nextSelections.some((selection) => selection === undefined)) {
		await vscode.commands.executeCommand('tab');
		return;
	}

	editor.selections = nextSelections as vscode.Selection[];
}

async function tabOutReverse() {
	const editor = vscode.window.activeTextEditor;

	if (!editor || !isTabOutEnabled()) {
		await vscode.commands.executeCommand('outdent');
		return;
	}

	const nextSelections = editor.selections.map((selection) => {
		if (!selection.isEmpty) {
			return undefined;
		}

		const lineText = editor.document.lineAt(selection.active.line).text;
		const nextCharacter = findReverseTabOutPosition(lineText, selection.active.character, getTabOutCharacterSets());

		if (nextCharacter === undefined) {
			return undefined;
		}

		const position = new vscode.Position(selection.active.line, nextCharacter);
		return new vscode.Selection(position, position);
	});

	if (nextSelections.some((selection) => selection === undefined)) {
		await vscode.commands.executeCommand('outdent');
		return;
	}

	editor.selections = nextSelections as vscode.Selection[];
}

async function toggleTabOut() {
	const configuration = vscode.workspace.getConfiguration('reactify');
	const enabled = configuration.get<boolean>('tabOut.enabled', true);
	await configuration.update('tabOut.enabled', !enabled, vscode.ConfigurationTarget.Global);
	vscode.window.showInformationMessage(`Reactify TabOut is ${enabled ? 'disabled' : 'enabled'}.`);
}

async function hungryDelete() {
	const editor = vscode.window.activeTextEditor;

	if (!editor) {
		return;
	}

	if (!vscode.workspace.getConfiguration('reactify').get<boolean>('hungryDelete.enabled', true)) {
		await vscode.commands.executeCommand('deleteLeft');
		return;
	}

	if (editor.selections.some((selection) => !selection.isEmpty)) {
		await vscode.commands.executeCommand('deleteLeft');
		return;
	}

	const deletionRanges = editor.selections.map((selection) => {
		const lineText = editor.document.lineAt(selection.active.line).text;
		const range = findHungryDeleteRange(lineText, selection.active.character);

		if (!range) {
			return undefined;
		}

		return new vscode.Range(
			new vscode.Position(selection.active.line, range.start),
			new vscode.Position(selection.active.line, range.end),
		);
	});

	if (deletionRanges.every((range) => range === undefined)) {
		await vscode.commands.executeCommand('deleteLeft');
		return;
	}

	await editor.edit((builder) => {
		for (const range of deletionRanges) {
			if (range) {
				builder.delete(range);
			}
		}
	});
}

class TagCodeActionProvider implements vscode.CodeActionProvider {
	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range,
		context: vscode.CodeActionContext,
	): vscode.CodeAction[] {
		if (context.only && !context.only.contains(vscode.CodeActionKind.QuickFix)) {
			return [];
		}

		const actionRange = getActiveSelectionRange(document) ?? range;
		const actions: vscode.CodeAction[] = [];

		if (!actionRange.isEmpty) {
			actions.push(createCommandCodeAction(
				'Emmet: Wrap with Abbreviation',
				'reactify.wrapSelectionWithTag',
			));
			addSelectionWrapActions(document, actionRange, actions, false);
		}

		const offset = document.offsetAt(actionRange.start);

		if (isInTagContext(document.getText(), offset)) {
			actions.push(
				createCommandCodeAction(
					'Emmet: Match Tag',
					'reactify.jumpToMatchingTag',
				),
				createCommandCodeAction(
					'Emmet: Remove Tag',
					'reactify.removeTagPreserveChildren',
				),
				createCommandCodeAction(
					'Emmet: Balance Inward',
					'reactify.balanceTagInward',
				),
				createCommandCodeAction(
					'Emmet: Balance Outward',
					'reactify.balanceTagOutward',
				),
			);
		}

		return actions;
	}
}

class ScriptCodeActionProvider implements vscode.CodeActionProvider {
	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range,
		context: vscode.CodeActionContext,
	): vscode.CodeAction[] {
		if (context.only && !context.only.contains(vscode.CodeActionKind.QuickFix)) {
			return [];
		}

		const actionRange = getActiveSelectionRange(document) ?? range;

		if (actionRange.isEmpty && !document.getWordRangeAtPosition(actionRange.start)) {
			return [];
		}

		const actions = [
			createCommandCodeAction(
				'Rename Symbol',
				'reactify.renameSymbol',
			),
			createCommandCodeAction(
				'Go to Definition',
				'reactify.goToDefinition',
			),
		];
		const functionToArrowEdit = createFunctionToArrowEdit(document.getText(), document.offsetAt(actionRange.start));
		const arrowToFunctionEdit = createArrowToFunctionEdit(document.getText(), document.offsetAt(actionRange.start));

		if (functionToArrowEdit) {
			const action = new vscode.CodeAction(
				'Convert function declaration to arrow function',
				vscode.CodeActionKind.QuickFix,
			);
			action.edit = new vscode.WorkspaceEdit();
			action.edit.replace(
				document.uri,
				new vscode.Range(
					document.positionAt(functionToArrowEdit.range.start),
					document.positionAt(functionToArrowEdit.range.end),
				),
				functionToArrowEdit.replacement,
			);
			actions.push(action);
		}

		if (arrowToFunctionEdit) {
			const action = new vscode.CodeAction(
				'Convert arrow function to function declaration',
				vscode.CodeActionKind.QuickFix,
			);
			action.edit = new vscode.WorkspaceEdit();
			action.edit.replace(
				document.uri,
				new vscode.Range(
					document.positionAt(arrowToFunctionEdit.range.start),
					document.positionAt(arrowToFunctionEdit.range.end),
				),
				arrowToFunctionEdit.replacement,
			);
			actions.push(action);
		}

		if (!actionRange.isEmpty && getFrameworkMode() === 'react') {
			actions.push(
				createCommandCodeAction(
					'Wrap selection in useMemo',
					'reactify.wrapSelectionInUseMemo',
				),
				createCommandCodeAction(
					'Wrap selection in useCallback',
					'reactify.wrapSelectionInUseCallback',
				),
			);
			addSelectionWrapActions(document, actionRange, actions, true);
		}

		return actions;
	}
}

function getActiveSelectionRange(document: vscode.TextDocument): vscode.Range | undefined {
	const editor = vscode.window.activeTextEditor;

	if (!editor || editor.document.uri.toString() !== document.uri.toString() || editor.selection.isEmpty) {
		return undefined;
	}

	return new vscode.Range(editor.selection.start, editor.selection.end);
}

function getFrameworkMode(): FrameworkMode {
	return vscode.workspace.getConfiguration('reactify').get<FrameworkMode>('frameworkMode', 'react');
}

function addSelectionWrapActions(
	document: vscode.TextDocument,
	range: vscode.Range,
	actions: vscode.CodeAction[],
	includeFragment: boolean,
) {
	if (includeFragment && fragmentActionLanguages.has(document.languageId)) {
		actions.push(createReplacementCodeAction(
			document,
			range,
			'Wrap selection in Fragment',
			wrapSelectionInFragment(document.getText(range)),
		));
	}

}

function createCommandCodeAction(title: string, command: string, args: unknown[] = []): vscode.CodeAction {
	const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
	action.command = {
		command,
		title,
		arguments: args,
	};

	return action;
}

function createReplacementCodeAction(
	document: vscode.TextDocument,
	range: vscode.Range,
	title: string,
	replacement: string,
): vscode.CodeAction {
	const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
	action.edit = new vscode.WorkspaceEdit();
	action.edit.replace(document.uri, range, replacement);

	return action;
}

function isTabOutEnabled(): boolean {
	return vscode.workspace.getConfiguration('reactify').get<boolean>('tabOut.enabled', true);
}

function getTabOutCharacterSets(): TabOutCharacterSet[] {
	return vscode.workspace.getConfiguration('reactify').get<TabOutCharacterSet[]>(
		'tabOut.characters',
		defaultTabOutCharacterSets,
	);
}
