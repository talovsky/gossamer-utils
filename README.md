# gossamer utils

a set of personal utils for front-end development

### hook tuple rename

```ts
const [state, setState] = useState();
// f2 ->
const [newStateName, setNewStateName] = useState();
```

renaming `state` to `newStateName` also renames `setState` to `setNewStateName`.

works with:

- `useState`
- `React.useState`
- `createSignal`
- `Solid.createSignal`

### js/ts quick fixes

vscode's quick fix menu is useless by default. we add:

- `Rename Symbol`
- `Go to Definition`
- `Convert function declaration to arrow function`
- `Convert arrow function to function declaration`
- `Wrap selection in useMemo`
- `Wrap selection in useCallback`
- `Wrap selection in Fragment`

set `gossamer-utils.framework` to `solid` to hide React-specific Quick Fixes like `useMemo` and `useCallback`. The default is `react`.

### html-ish quick fixes

- `Emmet: Wrap with Abbreviation`
- `Emmet: Match Tag`
- `Emmet: Remove Tag`
- `Emmet: Balance Inward`
- `Emmet: Balance Outward`

### go to bracket -> go to matching tag

- macOS: `Cmd+Shift+\`
- Windows/Linux: `Ctrl+Shift+\`

when the cursor is inside a <tag>, we use built-in `editor.emmet.action.matchTag` command.

in svelte files, it also jumps between matching block pairs such as `{#if}` / `{/if}`, `{#each}` / `{/each}`, `{#await}` / `{/await}`, and `{#key}` / `{/key}`.

when not inside a <tag> it falls back to VS Code's built-in bracket jump command.

### tabout

simplified version of tabout extension

`tab` -> jump outside of a `)}]:=<>.` `shift+tab` to jump back

use `gossamer-utils.tabout.characters` to extend.

### hungry delete

press `Backspace` to delete contiguous spaces and tabs before the cursor on the current line. stops at the previous non-whitespace character and falls back to vscode's normal backspace behavior when there is no whitespace to delete.
