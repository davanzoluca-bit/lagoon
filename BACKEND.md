# Lagoon backend setup

Lagoon uses Supabase for hosted Postgres, authentication, and private file storage. The frontend talks to Supabase's REST and Storage APIs with `fetch`; no separate application server or secret key is needed.

## Create the backend

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Choose a database password and a region near your users.
2. Open **SQL Editor → New query** and run the migration files in order: `20261028000000_lagoon_backend.sql`, `20261028000100_lagoon_weather_observations.sql`, `20261028000200_fishing_event_catches.sql`, `20261028000300_catch_time_and_position.sql`, `20261028000400_event_sharing_and_tags.sql`, `20261028000500_friends_and_feed_media.sql`, `20261028000600_friendship_sender_default.sql`, `20261028000700_post_visibility.sql`, then `20261028000800_lunar_phases.sql`. If your project already has the previous migrations, run only the new `20261028000800_lunar_phases.sql`; it creates a read-only lunar calendar and imports the supplied 2025–2026 phases.
3. Open **Project Settings → API**. Copy the Project URL and the publishable key (or legacy `anon` key). Do not put the `service_role` or secret key in the frontend.
4. Copy `.env.example` to `.env.local` and fill in:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   VITE_SITE_URL=https://lagoon-liart.vercel.app/
   ```

5. In **Authentication → Providers → Email**, leave email/password enabled. Configure SMTP before inviting real users. For a quick private prototype you can turn off email confirmation; turn it back on and configure SMTP before public launch.
6. Run the frontend locally with `npm run dev`. Create an account, add an event, and try a post. Those records are now persisted in the hosted database; event files go into the private `lagoon-attachments` bucket.

## Import the Comune di Venezia tide / water-temperature archive

The prepared file `data/weather/punta-salute-canal-grande-2026-04-to-10.csv` contains the Comune CSV normalized to database columns. It preserves all 52,662 source timestamps and missing values; timestamps remain in the source's fixed UTC+1 solar-time basis.

1. In Supabase **SQL Editor**, run `supabase/migrations/20261028000100_lagoon_weather_observations.sql`. It creates the station and observation tables, grants signed-in users read-only access, records the CC-BY attribution and ZMPS 1897 datum, and adds the Punta Salute Canal Grande station.
2. In **Table Editor**, select `weather_observations` and choose **Import data from CSV**. Upload `data/weather/punta-salute-canal-grande-2026-04-to-10.csv`; keep the header row enabled and map the four columns by name. Import all rows.
3. Reload Lagoon. The dashboard reads the latest water temperature, tide level and 24-hour trend from Supabase; **History** shows the latest imported observations.

The source file is raw and can contain sensor gaps. The import retains blank tide readings and does not interpolate or validate them.

## Refresh live Punta Salute water temperature

Vercel serves the authenticated `/api/refresh-weather` function. The dashboard calls it on load and every five minutes while open. It reads the Comune JSON feed, keeps only station `1025` (Punta Salute Canal Grande), and inserts readings using the `(station_id, recorded_at)` primary key with `ON CONFLICT DO NOTHING`, so retries do not create duplicate rows. The source supplies temperature only; tide values remain null.

In Vercel **Project → Settings → Environment Variables**, add `SUPABASE_SERVICE_ROLE_KEY` using the project's server-side `service_role` key, then redeploy. Keep this key server-only: never prefix it with `VITE_` or add it to `.env.example`. The function reuses the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values to validate the signed-in user's access token. Local Vite dev does not run Vercel Functions, so live refresh runs on the deployed site.

## Enable social sign-in

The login screen includes Google and Instagram buttons. Each provider needs its own credentials in Supabase; the browser never receives the provider secret.

### Google

1. In Google Cloud Console, create an OAuth client with application type **Web application**.
2. In Supabase **Authentication → Sign In / Providers → Google**, copy the callback URL shown there. Add it as an **Authorized redirect URI** in Google Cloud. Add `http://localhost:5173` as an authorized JavaScript origin while developing locally.
3. Paste the Google Client ID and Client Secret into Supabase's Google provider settings and enable the provider.

### Instagram

Instagram is not one of Supabase's built-in providers. The button uses Supabase's custom OAuth2 provider named `custom:instagram`, which must be configured separately:

1. In Meta for Developers, create/configure an app with **Instagram API with Instagram Login**. Meta currently limits that API to Instagram Business and Creator accounts; regular personal accounts cannot use this login flow. See [Meta's Instagram API documentation](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).
2. In Supabase **Authentication → Sign In / Providers → New Provider**, choose manual OAuth2 configuration and use the identifier `custom:instagram`. The Instagram Login endpoints are `https://www.instagram.com/oauth/authorize`, `https://api.instagram.com/oauth/access_token`, and `https://graph.instagram.com/me?fields=user_id,username`; request the `instagram_business_basic` scope. Use the callback URL Supabase displays as the redirect URI in the Meta app. Meta documents Instagram Login for professional accounts [here](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).
3. Allow sign-in without an email for this provider: Instagram Login does not provide an email address. If the Meta login form offers the Facebook login option, disable it for an Instagram-only flow. Enable the provider.

Social sign-in builds `redirect_to` from `VITE_SITE_URL` first, then `VITE_VERCEL_URL`, then the browser's current origin. Set the first two in Vercel under **Project → Settings → Environment Variables** (the `VITE_` prefix is required by Vite; `NEXT_PUBLIC_*` is a Next.js convention). For this project, set `VITE_SITE_URL` to `https://lagoon-liart.vercel.app/`. Supabase only accepts the destination if it is allowlisted; otherwise it can fall back to the configured **Site URL**, which commonly remains `http://localhost:5173` from local development. Configure **Authentication → URL Configuration** as follows:

1. Set **Site URL** to your deployed production URL, for example `https://your-project.vercel.app` (or your custom domain). Do not leave it set to localhost.
2. Add `http://localhost:5173/**` and the exact production URL with `/**`, for example `https://your-project.vercel.app/**`, under **Redirect URLs**.
3. If you use Vercel preview deployments, set `VITE_VERCEL_URL` for the Preview environment to the deployment hostname (without protocol, for example `lagoon-liart.vercel.app`) and add the matching preview pattern, such as `https://*-<team-or-account-slug>.vercel.app/**`. Use the wildcard format that matches your actual Vercel hostnames.

The Google **Authorized redirect URI** is a separate setting: it must remain the Supabase callback URL shown under **Authentication → Providers → Google**. Google returns to Supabase first; Supabase then redirects to the app URL above. Supabase requires app redirect destinations to match its Redirect URLs allowlist and recommends an exact production Site URL. See [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Publish the frontend

1. Push this project to a Git provider, or upload it to a static host that supports Vite builds.
2. In Vercel, choose **Add New → Project**, import the repository, and use the defaults (`npm run build`, output directory `dist`). Netlify can use the same build command and output directory.
3. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SITE_URL=https://lagoon-liart.vercel.app/` in Vercel's Production environment settings. Set `VITE_VERCEL_URL` in Preview if using preview deployments, then redeploy so Vite includes the values in the client bundle.
4. In Supabase **Authentication → URL Configuration**, set **Site URL** to the deployed site and allowlist the local and production URLs (plus the Vercel preview pattern, if used) as described above.

## What is connected

- Account sign-up/sign-in and session renewal.
- Private event journal with editable/deletable events, optional trip times, and file uploads. Fishing trips can include multiple fish species, quantities, optional catch date/time, and optional coordinates (entered manually or captured with browser geolocation).
- Community feed posts with photo/video uploads, plus user search and mutual friend requests.
- Private saved notes in the chat area. Direct user-to-user messaging is not implemented yet.
- Daily sunrise and sunset from Open-Meteo, using the browser's saved location. If location permission is declined on first use, Venice is selected; users can change the city from the active-location control. The app requests the API timezone automatically and links to Open-Meteo for attribution.

Weather readings, tide data, and weather forecasts still have no live provider connected, so their UI shows empty states instead of fabricated values. The free Open-Meteo API is for non-commercial use; commercial use requires a paid plan.

All user tables have row-level security enabled. The public browser key is designed to be visible; access is constrained by the policies in the migration. Never expose the service-role key. Apply schema changes through versioned SQL migrations; the SQL Editor instructions above are the fastest first deployment, while Supabase CLI migrations are preferable once the project is in active development.
