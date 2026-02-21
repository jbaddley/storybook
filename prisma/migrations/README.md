# Migrations

Migration order:

1. **`20250101000000_init`** – Base schema: `users`, `books`, `chapters`, and all core tables (comments, notes, variations, document_tabs, characters, locations, timeline_events, chapter_summaries, themes, motifs, symbols, plot_error_analyses, etc.). Does not include: `revision_passes`, `chapter_revision_completions`, `book_outlines`, `songs`.
2. **Additive migrations** – `20250208120000_add_revision_pass_and_completions`, `20250210120000_add_book_outline`, `20250211120000_add_songs`, `20250211130000_add_song_lyrics` add the remaining tables/columns.

With the initial migration in place, `prisma migrate dev` and `prisma migrate deploy` work against a fresh database (migrations apply in the order above).

## If you already ran `prisma db push` (tables already exist)

Record the migration as applied without running it (avoids "table already exists" errors):

```bash
npx prisma migrate resolve --applied 20250101000000_init
npx prisma migrate resolve --applied 20250208120000_add_revision_pass_and_completions
# ... and similarly for any other migration whose tables already exist
```

## If the revision tables do not exist yet

Apply migrations (this will run only the new migration):

```bash
npx prisma migrate deploy
```

## Avoid using `migrate dev` when it asks to reset

If `prisma migrate dev` ever prompts to reset the database ("All data will be lost"), choose **N** (No). Use `migrate deploy` to apply pending migrations instead, or `migrate resolve --applied` as above when the schema was already applied via `db push`.
