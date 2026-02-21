/**
 * Outline content: stored as string (TipTap JSON or legacy plain text).
 * Helpers to parse for the editor and to produce plain text for AI context.
 */

import { TipTapContent, DEFAULT_TIPTAP_CONTENT } from '../../shared/types';

const TIPTAP_DOC_PREFIX = '{"type":"doc"';

/** Parse stored outline string into TipTap content for the editor. */
export function parseOutlineContent(raw: string | undefined): TipTapContent {
  if (!raw || !raw.trim()) return DEFAULT_TIPTAP_CONTENT;
  const trimmed = raw.trim();
  if (trimmed.startsWith(TIPTAP_DOC_PREFIX)) {
    try {
      const parsed = JSON.parse(trimmed) as TipTapContent;
      if (parsed?.type === 'doc' && Array.isArray(parsed.content)) return parsed;
    } catch {
      // fall through to plain text
    }
  }
  // Legacy: plain text or Markdown – put in one paragraph
  return {
    type: 'doc',
    content: trimmed ? [{ type: 'paragraph', content: [{ type: 'text', text: trimmed }] }] : [{ type: 'paragraph', content: [] }],
  };
}

type TipTapNode = { type?: string; content?: TipTapNode[]; text?: string; attrs?: { level?: number } };

/** Recursively collect plain text from a TipTap node for AI context. */
function nodeToPlainText(node: TipTapNode): string {
  if (node.text) return node.text;
  const content = node.content;
  if (!content?.length) return '';

  if (node.type === 'heading') {
    const level = node.attrs?.level ?? 1;
    const text = content.map(nodeToPlainText).join('').trim();
    return (level ? '#'.repeat(level) + ' ' : '') + text;
  }
  if (node.type === 'bulletList') {
    return content
      .filter((c) => c.type === 'listItem')
      .map((c) => {
        const itemText = (c.content || []).map(nodeToPlainText).join('').trim();
        return itemText ? '- ' + itemText : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (node.type === 'orderedList') {
    return content
      .filter((c) => c.type === 'listItem')
      .map((c, i) => {
        const itemText = (c.content || []).map(nodeToPlainText).join('').trim();
        return itemText ? `${i + 1}. ${itemText}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return content.map(nodeToPlainText).join('').trim();
}

/** Convert stored outline content to plain text for AI/Story Craft context. */
export function outlineContentToPlainText(raw: string | undefined): string {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith(TIPTAP_DOC_PREFIX)) {
    try {
      const doc = JSON.parse(trimmed) as TipTapContent;
      if (doc?.type === 'doc' && Array.isArray(doc.content)) {
        return doc.content.map((node) => nodeToPlainText(node as TipTapNode)).filter(Boolean).join('\n\n');
      }
    } catch {
      // fall through
    }
  }
  return trimmed;
}

/** Convert markdown-like outline text (from AI or user) to TipTap content for storage. */
export function markdownLikeToTipTapContent(text: string): TipTapContent {
  const lines = text.split(/\r?\n/);
  const content: TipTapContent['content'] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    const h1 = /^#\s+(.+)$/.exec(trimmed);
    const h2 = /^##\s+(.+)$/.exec(trimmed);
    const h3 = /^###\s+(.+)$/.exec(trimmed);
    const bullet = /^[-*•]\s+(.+)$/.exec(trimmed);
    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    // Line that looks like a list item without leading bullet: "**Name** — description" (AI often omits bullet on continuation lines)
    const boldLabel = /^\*\*[^*]+\*\*[\s—\-]/.test(trimmed);
    if (h1) {
      content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: h1[1] }] });
      i++;
      continue;
    }
    if (h2) {
      content.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: h2[1] }] });
      i++;
      continue;
    }
    if (h3) {
      content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: h3[1] }] });
      i++;
      continue;
    }
    if (bullet || ordered || boldLabel) {
      const items: { type: 'listItem'; content: TipTapContent['content'] }[] = [];
      const bulletRe = /^[-*•]\s+(.+)$/;
      const orderedRe = /^\d+\.\s+(.+)$/;
      const boldLabelRe = /^\*\*[^*]+\*\*[\s—\-].*$/;
      while (i < lines.length) {
        const current = lines[i].trim();
        if (!current) {
          i++;
          continue;
        }
        let itemText: string | null = null;
        const bulletMatch = bulletRe.exec(current);
        const orderedMatch = orderedRe.exec(current);
        const boldMatch = boldLabelRe.exec(current);
        if (bulletMatch) {
          itemText = bulletMatch[1].trim();
        } else if (orderedMatch) {
          itemText = orderedMatch[1].trim();
        } else if (boldMatch) {
          // "**Name** — description" with or without leading bullet (AI often omits bullet on later lines)
          itemText = current;
        } else if (items.length > 0) {
          // End of list
          break;
        } else {
          break;
        }
        if (itemText !== null) {
          items.push({
            type: 'listItem',
            content: itemText ? [{ type: 'paragraph', content: [{ type: 'text', text: itemText }] }] : [{ type: 'paragraph', content: [] }],
          });
        }
        i++;
      }
      if (items.length) content.push({ type: 'bulletList', content: items });
      continue;
    }
    content.push({
      type: 'paragraph',
      content: trimmed ? [{ type: 'text', text: trimmed }] : [],
    });
    i++;
  }
  if (content.length === 0) return DEFAULT_TIPTAP_CONTENT;
  return { type: 'doc', content };
}
