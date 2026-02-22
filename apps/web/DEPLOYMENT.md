# Production deployment (Vercel)

Use this guide to get the **storybook** web app deployed and fix **"Error • new"** / **"No Production Deployment"**.

## 1. Connect Git repository

- In your deployment dashboard (e.g. Vercel), open the project.
- **Repository**: Connect your Git provider (GitHub / GitLab / Bitbucket) and select the **storybook** repo.
- If the project already exists, ensure it’s linked to the correct repo and branch (e.g. `main`).

## 2. Set Root Directory (monorepo)

The app lives in **`apps/web`**, not the repo root.

- **Root Directory**: Set to **`apps/web`**.
- Enable **Include source files outside of the Root Directory in the Build Step** (so the build can see `../../prisma/schema.prisma`). On many projects this is on by default.
- Leave **Build Command** and **Output Directory** as default (or use the values from `vercel.json`).

This makes the build run from `apps/web` and still see the Prisma schema at `../../prisma/schema.prisma`.

## 3. Environment variables

In the project’s **Settings → Environment Variables**, add these for **Production** (and Preview if you use it):

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g. from Neon, Supabase, or your DB host). |
| `NEXTAUTH_SECRET` | Yes | Random string, e.g. `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Yes | Production URL, e.g. `https://your-app.vercel.app`. Set this **after** the first deploy so you have the real URL. |
| `GOOGLE_CLIENT_ID` | Optional | For Google sign-in. |
| `GOOGLE_CLIENT_SECRET` | Optional | For Google sign-in. |

- **DATABASE_URL**: Must be a PostgreSQL URL your Vercel app can reach (not `localhost`). Use a hosted DB (Neon, Supabase, Railway, etc.).
- **NEXTAUTH_URL**: For the first deploy you can use a placeholder (e.g. `https://storybook.vercel.app`); after the first successful deploy, set it to the actual deployment URL and redeploy.

## 4. Database migrations

Run migrations against your **production** database **before** or right after the first deploy:

```bash
# From repo root, with DATABASE_URL pointing at production DB
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

Or use your host’s CLI/UI to run `prisma migrate deploy` with the production `DATABASE_URL`.

## 5. Redeploy and fix "Error • new"

- **Redeploy**: In the dashboard, open the latest deployment and use **Redeploy** (or push a new commit).
- **Build logs**: If the deployment still shows **Error • new**, open **Build Logs** and check the failing step:
  - **Install**: Missing or wrong Node version → set **Node.js Version** to **18.x** in project settings.
  - **Prisma**: `prisma generate` or schema path fails → confirm Root Directory is `apps/web` and `../../prisma/schema.prisma` exists in the clone.
  - **Next.js build**: Type or build errors → fix in code and push again.
- **Runtime errors**: After a successful build, if the site errors at runtime, check **Runtime Logs** and that `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are set correctly.

## 6. Production checklist (optional)

- **Custom domain**: In **Domains**, add your domain and follow the DNS instructions.
- **Visit**: Use **Visit** to open the live deployment URL and confirm sign-in and app behavior.

## Quick reference

- **Root Directory**: `apps/web`
- **Build**: `prisma generate --schema=../../prisma/schema.prisma && next build` (default in this app)
- **Required env**: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
