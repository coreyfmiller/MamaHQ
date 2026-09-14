# Enable "Continue with Google" — dashboard checklist

Two dashboards, ~5 minutes. The code is done; this is the config only you can do.

## A. Google Cloud — create an OAuth client

1. Go to https://console.cloud.google.com/ and pick (or create) a project.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**. Fill app name ("Mama HQ"), your support email, developer email.
   - You can leave it in **Testing** mode; add your own Google account under **Test users** so
     you can sign in. (Publishing is only needed for public launch.)
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name: "Mama HQ Web".
   - **Authorized redirect URI** — add EXACTLY this (it's your Supabase callback):
     `https://sccrnjhnfmtusvyzmngs.supabase.co/auth/v1/callback`
   - Create. Copy the **Client ID** and **Client secret**.

## B. Supabase — turn on the Google provider

1. Supabase dashboard → your project → **Authentication → Sign In / Providers** (or
   "Providers") → **Google**.
2. Toggle **Enable**, paste the **Client ID** and **Client secret** from step A, **Save**.
3. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (for local dev; change to the real domain after we
     deploy to Vercel).
   - **Redirect URLs**: add `http://localhost:3000/auth/callback`
     (and later the Vercel URL: `https://<your-app>.vercel.app/auth/callback`).

## C. Run the database migration (if not already)

In Supabase **SQL Editor**, run the contents of `supabase/migrations/0001_init.sql`.
(This replaces the old open Phase-A tables with the hardened, auth-scoped schema.)

## Done

Once A + B + C are complete, tell me and I'll verify sign-in end to end. Nothing secret goes in
the repo — the Client ID/secret live only in the Supabase dashboard; the app just uses your
existing NEXT_PUBLIC_SUPABASE_URL / anon key.
