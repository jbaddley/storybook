# Google OAuth: support web (Next.js) as well as desktop

The desktop app uses **loopback redirect** (`http://127.0.0.1:4000/oauth2callback`). The web app uses **NextAuth** and needs its own redirect URI. You can use the **same** OAuth 2.0 Client ID for both.

## Where to change it: Google Cloud Console

1. Open **[Google Cloud Console](https://console.cloud.google.com/)** and select your project.
2. Go to **APIs & Services** → **Credentials**.
3. Open the **OAuth 2.0 Client ID** you use for the desktop app (the one whose Client ID and Secret are in your `.env` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).
4. Under **Authorized redirect URIs**, add:
   - **Local dev (default port):**  
     `http://localhost:4050/api/auth/callback/google`
   - **If you use another port:**  
     `http://localhost:<port>/api/auth/callback/google`
   - **Production (e.g. Vercel):**  
     `https://<your-domain>/api/auth/callback/google`
5. Save.

No need to create a separate “Web application” client unless you want different credentials for web. One client can list both the desktop loopback URI and the web callback URIs.

## Scopes

- **Desktop** (Google Docs/Drive, sign-in): configured in `src/renderer/services/googleAuthService.ts` (Drive, Docs, userinfo).
- **Web** (sign-in only): NextAuth’s Google provider requests `email` and `profile` by default; no extra scopes needed for the online editor.

## Code references

- **Desktop redirect URI:** `src/main/ipc-handlers.ts` (around line 254: `REDIRECT_URI`) and `src/renderer/services/googleAuthService.ts` (around line 25: `REDIRECT_URI`). Both use `http://127.0.0.1:4000/oauth2callback`.
- **Web:** NextAuth uses `NEXTAUTH_URL` + `/api/auth/callback/google`. Set `NEXTAUTH_URL` in `apps/web/.env.local` (e.g. `http://localhost:4050` for dev).
