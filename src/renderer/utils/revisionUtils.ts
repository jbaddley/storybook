import type { RevisionPass, ChapterRevisionCompletion } from '../../shared/types';

/**
 * Get the latest revision pass that a chapter has completed (highest revisionNumber among completions).
 */
export function getLatestRevisionPassForChapter(
  chapterId: string,
  revisionPasses: RevisionPass[],
  chapterRevisionCompletions: ChapterRevisionCompletion[]
): RevisionPass | null {
  const completedRevisionIds = chapterRevisionCompletions
    .filter((c) => c.chapterId === chapterId)
    .map((c) => c.revisionId);
  const completedPasses = revisionPasses.filter((p) => completedRevisionIds.includes(p.id));
  if (completedPasses.length === 0) return null;
  return completedPasses.reduce((a, b) =>
    a.revisionNumber >= b.revisionNumber ? a : b
  );
}

/**
 * Check if a chapter is marked done for a specific revision pass.
 */
export function isChapterDoneForRevision(
  chapterId: string,
  revisionId: string,
  chapterRevisionCompletions: ChapterRevisionCompletion[]
): boolean {
  return chapterRevisionCompletions.some(
    (c) => c.chapterId === chapterId && c.revisionId === revisionId
  );
}
