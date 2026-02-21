-- CreateTable
CREATE TABLE "songs" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "style" TEXT NOT NULL DEFAULT '',
    "genre" TEXT NOT NULL DEFAULT '',
    "characters" JSONB NOT NULL DEFAULT '[]',
    "tempo" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL DEFAULT '',
    "instruments" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "songs_bookId_idx" ON "songs"("bookId");

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
