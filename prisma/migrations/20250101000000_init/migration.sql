-- Initial migration: base schema (users, books, chapters, and all tables not added by later migrations).
-- Later migrations add: revision_passes, chapter_revision_completions, book_outlines, songs, songs.lyrics.

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "googleId" TEXT NOT NULL,
    "picture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph","content":[]}]}',
    "order" INTEGER NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "purpose" TEXT,
    "originalContent" JSONB,
    "originalWordCount" INTEGER,
    "variationAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_comments" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "targetText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_notes" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_variations" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "prompt" TEXT NOT NULL,
    "basedOnStoryCraft" BOOLEAN NOT NULL DEFAULT false,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeReport" JSONB,
    "sourceVariationId" TEXT,
    "settings" JSONB,

    CONSTRAINT "chapter_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storycraft_feedback" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "chapterTitle" TEXT NOT NULL,
    "assessment" JSONB NOT NULL,
    "checklist" JSONB NOT NULL,
    "summary" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storycraft_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_promises" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "chapterTitle" TEXT NOT NULL,

    CONSTRAINT "story_promises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promises_kept" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "promiseId" TEXT NOT NULL,
    "promiseDescription" TEXT NOT NULL,
    "howKept" TEXT NOT NULL,
    "chapterWherePromised" TEXT NOT NULL,
    "chapterTitleWherePromised" TEXT NOT NULL,

    CONSTRAINT "promises_kept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_tabs" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph","content":[]}]}',
    "icon" TEXT,
    "color" TEXT,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "tabType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "firstAppearance" TEXT NOT NULL,
    "mentions" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "mentions" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT,
    "sortDate" TEXT,
    "dateType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "chapterTitle" TEXT,
    "order" INTEGER NOT NULL,
    "chronologicalOrder" INTEGER,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_summaries" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyPoints" JSONB NOT NULL DEFAULT '[]',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chapterAppearances" JSONB NOT NULL DEFAULT '[]',
    "evolutionNotes" TEXT NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motifs" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chapterAppearances" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "motifs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symbols" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "chapterAppearances" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "symbols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plot_error_analyses" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plot_error_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_plot_analyses" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "chapterTitle" TEXT NOT NULL,
    "proposedTitle" TEXT,
    "roles" JSONB NOT NULL DEFAULT '[]',
    "plotSummary" TEXT,
    "chapterTheme" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "chapter_plot_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plot_errors" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "context" TEXT,
    "affectedChapters" JSONB NOT NULL DEFAULT '[]',
    "chapterIds" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "plot_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "books_userId_idx" ON "books"("userId");

-- CreateIndex
CREATE INDEX "chapters_bookId_idx" ON "chapters"("bookId");

-- CreateIndex
CREATE INDEX "chapters_bookId_order_idx" ON "chapters"("bookId", "order");

-- CreateIndex
CREATE INDEX "chapter_comments_chapterId_idx" ON "chapter_comments"("chapterId");

-- CreateIndex
CREATE INDEX "chapter_notes_chapterId_idx" ON "chapter_notes"("chapterId");

-- CreateIndex
CREATE INDEX "chapter_variations_chapterId_idx" ON "chapter_variations"("chapterId");

-- CreateIndex
CREATE INDEX "chapter_variations_chapterId_generatedAt_idx" ON "chapter_variations"("chapterId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "storycraft_feedback_chapterId_key" ON "storycraft_feedback"("chapterId");

-- CreateIndex
CREATE INDEX "story_promises_feedbackId_idx" ON "story_promises"("feedbackId");

-- CreateIndex
CREATE INDEX "promises_kept_feedbackId_idx" ON "promises_kept"("feedbackId");

-- CreateIndex
CREATE INDEX "document_tabs_bookId_idx" ON "document_tabs"("bookId");

-- CreateIndex
CREATE INDEX "characters_bookId_idx" ON "characters"("bookId");

-- CreateIndex
CREATE INDEX "locations_bookId_idx" ON "locations"("bookId");

-- CreateIndex
CREATE INDEX "timeline_events_bookId_idx" ON "timeline_events"("bookId");

-- CreateIndex
CREATE INDEX "chapter_summaries_bookId_idx" ON "chapter_summaries"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_summaries_bookId_chapterId_key" ON "chapter_summaries"("bookId", "chapterId");

-- CreateIndex
CREATE INDEX "themes_bookId_idx" ON "themes"("bookId");

-- CreateIndex
CREATE INDEX "motifs_bookId_idx" ON "motifs"("bookId");

-- CreateIndex
CREATE INDEX "symbols_bookId_idx" ON "symbols"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "plot_error_analyses_bookId_key" ON "plot_error_analyses"("bookId");

-- CreateIndex
CREATE INDEX "plot_error_analyses_bookId_idx" ON "plot_error_analyses"("bookId");

-- CreateIndex
CREATE INDEX "chapter_plot_analyses_analysisId_idx" ON "chapter_plot_analyses"("analysisId");

-- CreateIndex
CREATE INDEX "chapter_plot_analyses_chapterId_idx" ON "chapter_plot_analyses"("chapterId");

-- CreateIndex
CREATE INDEX "plot_errors_analysisId_idx" ON "plot_errors"("analysisId");

-- CreateIndex
CREATE INDEX "plot_errors_type_idx" ON "plot_errors"("type");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_comments" ADD CONSTRAINT "chapter_comments_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_notes" ADD CONSTRAINT "chapter_notes_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_variations" ADD CONSTRAINT "chapter_variations_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storycraft_feedback" ADD CONSTRAINT "storycraft_feedback_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_promises" ADD CONSTRAINT "story_promises_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "storycraft_feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promises_kept" ADD CONSTRAINT "promises_kept_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "storycraft_feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tabs" ADD CONSTRAINT "document_tabs_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_summaries" ADD CONSTRAINT "chapter_summaries_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motifs" ADD CONSTRAINT "motifs_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbols" ADD CONSTRAINT "symbols_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plot_error_analyses" ADD CONSTRAINT "plot_error_analyses_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_plot_analyses" ADD CONSTRAINT "chapter_plot_analyses_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "plot_error_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plot_errors" ADD CONSTRAINT "plot_errors_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "plot_error_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
