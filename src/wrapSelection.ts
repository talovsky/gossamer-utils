export type HookWrapper = 'useMemo' | 'useCallback';

export function wrapSelectionInHook(text: string, wrapper: HookWrapper): string {
	const trimmed = text.trim();
	const expression = toCallbackExpression(trimmed);

	return `${wrapper}(${expression}, [])`;
}

export function wrapSelectionInFragment(text: string): string {
	return `<>${text}</>`;
}

function toCallbackExpression(trimmed: string): string {
	if (trimmed.startsWith('() =>') || trimmed.startsWith('async ') || trimmed.startsWith('function')) {
		return trimmed;
	}

	if (isStatementLikeSelection(trimmed)) {
		return `() => {\n${trimmed}\n}`;
	}

	return `() => ${trimmed}`;
}

function isStatementLikeSelection(trimmed: string): boolean {
	return /^(const|let|var|function|class|if|for|while|switch|try|return|throw|import|export)\b/.test(trimmed)
		|| /;\s*$/.test(trimmed);
}
