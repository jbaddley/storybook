/**
 * Normalize quotes and apostrophes so all content uses the same characters.
 * Target: straight (ASCII) quotes — ' (U+0027) and " (U+0022).
 * Handles smart/curly quotes, backticks, and other common variants.
 */

// All characters that should become straight single quote / apostrophe
const SINGLE_QUOTE_VARIANTS = /[\u2018\u2019\u201A\u201B\u2039\u203A\u0060\u00B4\u02BC\u02B9\u2032\u2033\u2034]/g;
// All characters that should become straight double quote
const DOUBLE_QUOTE_VARIANTS = /[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2033\u2036\u301D\u301E\u301F\uFF02]/g;

/**
 * Normalize a plain string: replace all quote/apostrophe variants with straight ' and ".
 */
export function normalizeQuotesInText(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(DOUBLE_QUOTE_VARIANTS, '"')
    .replace(SINGLE_QUOTE_VARIANTS, "'");
}

/**
 * Walk TipTap content (doc or node) and normalize quotes in every text node.
 * Mutates nodes in place; returns the same structure.
 */
export function normalizeQuotesInTipTapContent(node: any): any {
  if (!node) return node;
  if (node.type === 'text' && typeof node.text === 'string') {
    return { ...node, text: normalizeQuotesInText(node.text) };
  }
  if (Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content.map((child: any) => normalizeQuotesInTipTapContent(child)),
    };
  }
  return node;
}
