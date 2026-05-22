# reactify

Smarter React and Solid editor commands.

## Features

### Hook tuple rename

Place the cursor on either side of a supported hook tuple and run VS Code rename with `F2`.

```ts
const [state, setState] = useState();
```

Renaming `state` to `newStateName` also renames `setState` to `setNewStateName`.

```ts
const [newStateName, setNewStateName] = useState();
```

Supported callees:

- `useState`
- `React.useState`
- `createSignal`
- `Solid.createSignal`

The extension activates for JavaScript, JavaScript React, TypeScript, and TypeScript React files.

### Symbol quick fixes

Use Quick Fix (`Cmd+.` on macOS, `Ctrl+.` on Windows/Linux) on an identifier in JavaScript, TypeScript, JSX, or TSX and choose:

- `Rename Symbol`
- `Go to Definition`
- `Convert function declaration to arrow function`
- `Convert arrow function to function declaration`
- `Wrap selection in useMemo`
- `Wrap selection in useCallback`
- `Wrap selection in Fragment`

Rename and Go to Definition delegate to VS Code's built-in commands. The function conversions handle straightforward declarations like `function s() {}`, `const s = () => {}`, and `export async function load<T>(id: T): Promise<T> {}`. The hook wrappers are shown for non-empty selections and produce `useMemo(() => expression, [])` or `useCallback(callback, [])`.

Set `reactify.frameworkMode` to `solid` to hide React-specific Quick Fixes like `useMemo` and `useCallback`. The default is `react`.

### Jump to matching tag

Use the regular “Go to Bracket” keybinding:

- macOS: `Cmd+Shift+\`
- Windows/Linux: `Ctrl+Shift+\`

When the cursor is inside an HTML, JSX, Svelte, Astro, or Vue tag, the extension delegates to VS Code's built-in `editor.emmet.action.matchTag` command. In Svelte files, it also jumps between matching block pairs such as `{#if}` / `{/if}`, `{#each}` / `{/each}`, `{#await}` / `{/await}`, and `{#key}` / `{/key}`.

Everywhere else, it falls back to VS Code's built-in bracket jump command.

### Tag quick fixes

Use Quick Fix (`Cmd+.` on macOS, `Ctrl+.` on Windows/Linux) inside a tag or its contents and choose:

- `Emmet: Wrap with Abbreviation`
- `Emmet: Match Tag`
- `Emmet: Remove Tag`
- `Emmet: Balance Inward`
- `Emmet: Balance Outward`

These actions delegate to VS Code's built-in Emmet commands. Wrap with Abbreviation is shown for non-empty selections. Remove Tag uses `editor.emmet.action.removeTag`, so the tag is removed while its children are preserved. These actions are available in JavaScript, TypeScript, JSX, TSX, HTML, Svelte, Astro, and Vue files.

### TabOut

Press `Tab` next to configured characters to jump past them instead of inserting a tab. Press `Shift+Tab` to jump back to the previous configured character.

Defaults include brackets, braces, parentheses, quotes, `:`, `=`, `<`, `>`, `.`, backticks, and semicolons. Configure them with `reactify.tabOut.characters`, and toggle the behavior with `Reactify: Toggle TabOut`.

### Hungry Delete

Press `Backspace` to delete contiguous spaces and tabs before the cursor on the current line. It stops at the previous non-whitespace character and falls back to VS Code's normal backspace behavior when there is no whitespace to delete.
