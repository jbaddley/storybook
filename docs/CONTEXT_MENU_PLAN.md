# Editor Context Menu – Implementation Plan

## Goal

Add a custom context menu in the editor that:

1. **Correct spelling** – Shown at the top; replaces the word under the cursor with the first spell-check suggestion when available.
2. **Add to chat** – Takes the sentence under the cursor, opens the AI panel on the Chat tab, and pre-fills the chat with that sentence as the first user message (same behavior as Comments “Send to Chat”).

---

## 1. Store: Pending chat message

**Current state:** `AIPanel` holds `pendingChatMessage` in local state and passes it to `AIChatBot`. The Comments panel calls `handleSendCommentToChat(text)`, which sets that state and switches to the chat tab.

**Change:** Lift `pendingChatMessage` into the store so the Editor (and any other component) can trigger “add to chat” without going through AIPanel.

- **bookStore**
  - Add to `UIState`: `pendingChatMessage: string | null`
  - Add action: `setPendingChatMessage: (msg: string | null) => void`
  - Initial: `pendingChatMessage: null`
- **AIPanel**
  - Remove local `useState` for `pendingChatMessage`
  - Use `ui.pendingChatMessage` and `setPendingChatMessage` from the store
  - Keep `handleSendCommentToChat(text)` but implement as: `setPendingChatMessage(text); setAIPanelTab('chat');`
  - Ensure panel is visible when opening chat (e.g. if `!ui.showAIPanel` then call `setPanelSettings({ showAIPanel: true })` or a dedicated “open AI panel” action)

**Result:** Any component can call `setPendingChatMessage(sentence)` + `setAIPanelTab('chat')` + ensure `showAIPanel` is true, and the existing AIChatBot `pendingChatMessage` / `onConsumedPendingMessage` flow will work unchanged.

---

## 2. Sentence at cursor

**Requirement:** Given the TipTap editor and current selection, return the sentence that contains the cursor (or the selected text if it spans more than one sentence).

**Approach:**

- Use the **block** (paragraph/heading) containing the cursor so we don’t pull text from other blocks.
- Map ProseMirror position `selection.from` to a **character index** within that block’s plain text.
- In that block’s text, find **sentence boundaries** (e.g. split on `[.!?]+\s+` and newlines), then the segment that contains the character index.
- Return the trimmed sentence (or, if there is a selection and it’s non-empty, optionally use selected text instead of “sentence at cursor” for “Add to chat” – product choice).

**Implementation details:**

- TipTap editor exposes `editor.state` (ProseMirror). Use `state.selection.$from` to get the parent block (e.g. `$from.blockRange()` or the block node that contains the cursor).
- Block text: `blockNode.textContent` or `state.doc.textBetween(blockStart, blockEnd, ' ')`.
- Cursor offset within block: ProseMirror position is `from`; block start is known (e.g. from `$from.start()` of the block). So “position within block” = `from - blockStart`. Map that to a character index by counting characters in the block from 0 to that position (e.g. using `block.node.textBetween(0, from - blockStart, ' ')` and taking its length, or iterating text nodes).
- Sentence extraction: in the block string, find the slice that contains the character index. Simple rule: look backward for the last `. ` or `! ` or `? ` or start of string; look forward for the next `. ` or `! ` or `? ` or end of string; return that substring trimmed.

**Where:** Implement a small helper (e.g. `getSentenceAtCursor(editor): string | null`) used by the context menu. It can live in the Editor file or in a shared editor util.

**Edge cases:** Empty block → return `null`. Cursor in whitespace → still return the sentence that contains that offset. No sentence delimiters in block → treat whole block as one “sentence”.

---

## 3. Context menu UI and placement

**Where:** Editor only (chapter content). Not required on document tabs unless you want the same behavior there later.

**Behavior:**

- On **right‑click** inside the editor (ProseMirror area):
  - Prevent the default browser context menu.
  - Compute:
    - Sentence (or selection) for “Add to chat”.
    - Optional: word under cursor and spell-check suggestion for “Correct spelling”.
  - Show a **custom menu** positioned at the mouse (e.g. `position: fixed`, `left: event.clientX`, `top: event.clientY`).

**Menu structure:**

1. **Correct spelling** (top)
   - If there is a misspelled word and a suggestion: show e.g. “Correct spelling: \<suggestion\>” and on click replace the word with the suggestion.
   - If no suggestion yet (or spell-check not implemented): show “Correct spelling” and either disable it or wire to a placeholder (e.g. toast “Spell-check coming soon”) until a spell-check source is added.
2. **Add to chat**
   - Only enable if we have non-empty sentence (or selection).
   - On click: call `setPendingChatMessage(sentence)`, `setAIPanelTab('chat')`, and ensure the AI panel is open (`setPanelSettings({ showAIPanel: true })` or equivalent). Then close the context menu.

**Implementation options:**

- **Option A – `editorProps.handleContextMenu`**  
  In `useEditor({ editorProps: { handleContextMenu(view, event) { ... } } })`, prevent default, compute sentence/word, set state to open a React-rendered menu at `(event.clientX, event.clientY)`. Editor component holds menu state (e.g. `contextMenu: { x, y, sentence, word, suggestion } | null`) and renders the menu in a portal or fixed div.
- **Option B – Wrapper with `onContextMenu`**  
  Wrap the editor (or `EditorContent`) in a `div` that has `onContextMenu`. You need access to the editor instance (e.g. from `useEditor` in the same component) to call `getSentenceAtCursor(editor)` and to know selection. So the handler still lives in the same Editor component; the wrapper just ensures the event is captured over the editor area.

Use a single piece of state for the menu, e.g.:

- `contextMenu: null | { x: number; y: number; sentence: string; word?: string; suggestion?: string }`

Render the menu as a small dropdown (list of buttons or divs) and close it on click (outside or on an item) or on blur.

---

## 4. Correct spelling – spell-check source

**Options:**

- **Electron:** Use `webUtils` / spell-checker if available in your Electron version (e.g. `webUtils.getWordSuggestion()` or a spell-checker API). On context menu open, if the word under cursor is misspelled, get suggestions and show the first as “Correct spelling: \<word\>”.
- **Browser / future:** If you add a spell-check library or browser API later, the same menu item can call that and replace the word on click.
- **MVP:** Implement the menu item “Correct spelling” at the top and the replacement behavior (replace range in document with suggested word). If no spell-check API is connected, show the item as disabled or with a “Coming soon” behavior so the layout and flow are in place.

**Word under cursor:** Use selection: if there is a collapsed cursor, expand to word boundaries (e.g. regex `\b` or split on spaces/punctuation and find the segment containing the cursor index). Store `word` and optional `suggestion` in context menu state and replace that range in the editor when “Correct spelling” is clicked (same kind of range replacement as in AIChatBot edits).

---

## 5. File and code touch points

| Area | Change |
|------|--------|
| **bookStore** | Add `pendingChatMessage`, `setPendingChatMessage`; optionally add “ensure AI panel open” helper or use `setPanelSettings({ showAIPanel: true })`. |
| **AIPanel** | Use store for `pendingChatMessage`; in `handleSendCommentToChat` ensure panel is shown when opening chat. |
| **Editor** | Add context menu state; add handler (e.g. `editorProps.handleContextMenu` or wrapper `onContextMenu`); implement or import `getSentenceAtCursor(editor)`; render custom menu (Correct spelling, Add to chat); on “Add to chat” call store actions and close menu. |
| **Shared util (optional)** | `getSentenceAtCursor(editor)`, and optionally `getWordAtCursor(editor)` for spelling. |
| **Styles** | Styles for the context menu (e.g. `.editor-context-menu`) to match app (z-index above editor, padding, hover states). |

---

## 6. Order of implementation

1. **Store** – Add `pendingChatMessage` and `setPendingChatMessage`; refactor AIPanel to use them. Verify Comments “Send to Chat” and existing chat flow still work.
2. **Sentence helper** – Implement `getSentenceAtCursor(editor)` and unit-test or manually test with a few paragraphs.
3. **Context menu shell** – In Editor: prevent default context menu, show a small menu at cursor with two items (Correct spelling, Add to chat). “Add to chat” calls store and opens panel/chat; “Correct spelling” can be no-op or placeholder.
4. **Correct spelling** – Add word-at-cursor helper; integrate spell-check source if available (e.g. Electron); implement replace-on-click; otherwise leave as disabled or “Coming soon”.
5. **Polish** – Close menu on outside click/escape; ensure menu doesn’t overflow viewport; accessibility (keyboard, focus).

---

## 7. Summary

- **Correct spelling** at the top: replace word under cursor with first suggestion; spell-check can be wired to Electron or a future library; menu structure supports it from day one.
- **Add to chat**: sentence (or selection) at cursor → `setPendingChatMessage(sentence)` + switch to chat tab + ensure AI panel is open; existing AIChatBot `pendingChatMessage` handling does the rest.
- **Store** holds `pendingChatMessage` so both Comments and Editor can trigger the same “open chat with this text” behavior.
