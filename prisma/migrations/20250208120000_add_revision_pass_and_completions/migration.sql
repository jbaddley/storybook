-- CreateTable
CREATE TABLE "revision_passes" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_revision_completions" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_revision_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revision_passes_bookId_revisionNumber_key" ON "revision_passes"("bookId", "revisionNumber");

-- CreateIndex
CREATE INDEX "revision_passes_bookId_idx" ON "revision_passes"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_revision_completions_chapterId_revisionId_key" ON "chapter_revision_completions"("chapterId", "revisionId");

-- CreateIndex
CREATE INDEX "chapter_revision_completions_chapterId_idx" ON "chapter_revision_completions"("chapterId");

-- CreateIndex
CREATE INDEX "chapter_revision_completions_revisionId_idx" ON "chapter_revision_completions"("revisionId");

-- AddForeignKey
ALTER TABLE "revision_passes" ADD CONSTRAINT "revision_passes_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_revision_completions" ADD CONSTRAINT "chapter_revision_completions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_revision_completions" ADD CONSTRAINT "chapter_revision_completions_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "revision_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
