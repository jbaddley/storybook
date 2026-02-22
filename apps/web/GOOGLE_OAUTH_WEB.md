# Google OAuth: support web (Next.js) as well as desktop

The desktop app uses **loopback redirect** (`http://127.0.0.1:4000/oauth2callback`). The web app uses **NextAuth** and needs its own redirect URI. You can use the **same** OAuth 2.0 Client ID for both.

## Fix "Error 400: redirect_uri_mismatch"

Google rejects sign-in when the redirect URI sent by the app does **not exactly** match one of the URIs in the Console. Do this:

1. **Copy this exact URI** (no trailing slash, `http`, port 4050):
   ```
   http://localhost:4050/api/auth/callback/google
   ```
2. Open **[Google Cloud Console](https://console.cloud.google.com/)** → your project → **APIs & Services** → **Credentials**.
3. Open the **OAuth 2.0 Client ID** that matches your `GOOGLE_CLIENT_ID` (e.g. "Web client" or the one used by the desktop app).
4. Under **Authorized redirect URIs**, click **+ ADD URI**, paste the URI above, then **Save**.
5. Wait a minute for changes to apply, then try "Sign in with Google" again at `http://localhost:4050`.

If you run the app on a different port, use that port in the URI (e.g. `http://localhost:3000/api/auth/callback/google`) and in `NEXTAUTH_URL` in `apps/web/.env`.

### Still getting redirect_uri_mismatch after saving?

1. **Client type** – The OAuth client must be **"Web application"**, not "Desktop app". The desktop app uses a different client (loopback URI). In Credentials, open the client whose Client ID matches `GOOGLE_CLIENT_ID` in `apps/web/.env`; if it says "Desktop" or "Chrome", create a **new** OAuth 2.0 Client ID of type **Web application**, add the redirect URI there, and put the new Client ID and Secret in `apps/web/.env`.

2. **Client ID match** – In Console, the client you edited must show the **exact** same Client ID as in `apps/web/.env`. If you have several clients, you may have added the URI to the wrong one.

3. **Confirm what the app sends** – Restart the dev server, click "Sign in with Google", and check the terminal where `npm run web:dev` is running. You should see a log like `[NextAuth] Redirect URI sent to Google: http://localhost:4050/api/auth/callback/google`. That string must match the Authorized redirect URI in the Console character-for-character.

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

## Port must match (avoid 404 on sign-in)

Use the **same** URL in all three places; otherwise you may get a 404 or “OAuthSignin” error:

1. **Browser:** Open the app at that URL (e.g. `http://localhost:4050`).
2. **`apps/web/.env.local`:** `NEXTAUTH_URL=http://localhost:4050` (same host and port).
3. **Google Console → Authorized redirect URIs:** `http://localhost:4050/api/auth/callback/google`.

If you run the app on a different port (e.g. `npm run dev -- -p 3000`), use that port in both `NEXTAUTH_URL` and in Google Console.
