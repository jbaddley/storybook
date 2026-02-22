/**
 * Flush the active chapter editor content from the TipTap instance into the book store.
 * Call this before saving or syncing so the store has the latest editor content.
 */
import { useBookStore } from '../stores/bookStore';

export function flushActiveEditorToStore(): void {
  const { activeChapterId, updateChapterContent } = useBookStore.getState();
  const editor = (typeof window !== 'undefined' && (window as unknown as { __tiptapEditor?: { getJSON: () => unknown } }).__tiptapEditor);
  if (activeChapterId && editor?.getJSON) {
    const content = editor.getJSON();
    if (content && typeof content === 'object' && 'type' in content) {
      updateChapterContent(activeChapterId, content as { type: 'doc'; content?: unknown[] });
    }
  }
}
