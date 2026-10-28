# Lagoon backend setup

Lagoon uses Supabase for hosted Postgres, authentication, and private file storage. The frontend talks to Supabase's REST and Storage APIs with `fetch`; no separate application server or secret key is needed.

## Create the backend

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Choose a database password and a region near your users.
2. Open **SQL Editor → New query**, paste the complete contents of `supabase/migrations/20261028000000_lagoon_backend.sql`, and run it.
3. Open **Project Settings → API**. Copy the Project URL and the publishable key (or legacy `anon` key). Do not put the `service_role` or secret key in the frontend.
4. Copy `.env.example` to `.env.local` and fill in:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

5. In **Authentication → Providers → Email**, leave email/password enabled. Configure SMTP before inviting real users. For a quick private prototype you can turn off email confirmation; turn it back on and configure SMTP before public launch.
6. Run the frontend locally with `npm run dev`. Create an account, add an event, and try a post. Those records are now persisted in the hosted database; event files go into the private `lagoon-attachments` bucket.

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

Social sign-in redirects back to the app URL. Add `http://localhost:5173/**` to **Authentication → URL Configuration → Redirect URLs**. When the site is deployed, add its production URL there too. Supabase documents that the app redirect must be on this allow list: [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Publish the frontend

1. Push this project to a Git provider, or upload it to a static host that supports Vite builds.
2. In Vercel, choose **Add New → Project**, import the repository, and use the defaults (`npm run build`, output directory `dist`). Netlify can use the same build command and output directory.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the host's project environment settings for Production (and Preview if desired), then deploy.
4. In Supabase **Authentication → URL Configuration**, set the deployed site URL and add the local and production URLs to the redirect allow list.

## What is connected

- Account sign-up/sign-in and session renewal.
- Private event journal with date, notes, and file uploads.
- Community text posts.
- Private saved notes in the chat area. Direct user-to-user messaging is not implemented yet.

Weather readings, tide data, and forecasts currently have no provider connected, so their UI shows empty states instead of fabricated values. Add a trusted data provider and ingestion process before displaying those readings.

All user tables have row-level security enabled. The public browser key is designed to be visible; access is constrained by the policies in the migration. Never expose the service-role key. Apply schema changes through versioned SQL migrations; the SQL Editor instructions above are the fastest first deployment, while Supabase CLI migrations are preferable once the project is in active development.
