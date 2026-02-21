-- CreateTable
CREATE TABLE "book_outlines" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_outlines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_outlines_bookId_key" ON "book_outlines"("bookId");

-- CreateIndex
CREATE INDEX "book_outlines_bookId_idx" ON "book_outlines"("bookId");

-- AddForeignKey
ALTER TABLE "book_outlines" ADD CONSTRAINT "book_outlines_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
