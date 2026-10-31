# Supabase backend

NUMO's whole backend is a hosted Supabase project: Auth (email + password, 6-digit
email codes), a Postgres database, Storage for profile photos, and one database
function. There is no other server.

**The CLI is not set up yet.** The schema, policies and functions live only in the
Supabase dashboard; this folder doesn't contain them. Until it does, record every
dashboard change in [MANUAL_CHANGES.md](MANUAL_CHANGES.md), with its SQL.

```
supabase/
  README.md           This file.
  MANUAL_CHANGES.md   Changes made by hand in the dashboard, with equivalent SQL.
  config.toml         Created by `supabase init`; only used for local development once the CLI is set up.
```

## What the backend holds

*Inferred from the app code; not yet checked against the database.*

| Part | What it does |
|---|---|
| `auth.users` | Accounts. Supabase sends the sign-up and password-reset codes. |
| `public.profiles` | One row per user (`id` = `auth.users.id`): name, photo URL, and the plan from onboarding (goal, weak spots, comfort level, daily question goal, time per day, days per week, `level_set_at`). The app only ever updates this row, so something must create it at sign-up, presumably a trigger on `auth.users`. |
| `public.workout_sessions` | One row per finished workout: operation, level, score, time, `source` (warmup / coach / manual) and a per-operation `breakdown`. The app only inserts and reads these rows, never updates them. |
| `public.delete_user()` | Called by Settings → Delete Account. `SECURITY DEFINER` with `search_path` set; deletes the caller's `auth.users` row. |
| Storage bucket `avatars` | Profile photos at `<user id>/avatar_<ms>.<ext>`. Public; see below. |

## Deleting an account relies on ON DELETE CASCADE

`delete_user()` deletes only the `auth.users` row. `profiles` and `workout_sessions`
disappear because their foreign keys to `auth.users` are `ON DELETE CASCADE`.
Storage files don't cascade, so the app removes the user's photos itself, just
before calling `delete_user()` (`deleteUserAccount` in
`src/services/settingsService.ts`). If that cleanup fails, the account is still
deleted and the error is logged.

> **Any new table that holds a user's data must reference `auth.users(id)` with
> `ON DELETE CASCADE`.** Otherwise its rows outlive the account, or the delete fails
> on the foreign key. New Storage buckets with user files also need their own
> cleanup in `deleteUserAccount`.

## Profile photos: public bucket

`profiles.avatar_url` stores the photo's full public URL, and the app shows it
directly. Each upload gets a new file name. After a successful upload the app
deletes the user's older files. "Remove Photo" and account deletion delete them all.

What the app needs from the storage policies on `storage.objects`, all limited to
`bucket_id = 'avatars'` and the user's own folder
(`(storage.foldername(name))[1] = auth.uid()::text`):

| Operation | Used for | Status |
|---|---|---|
| SELECT | Listing old files to delete them | "Users can read own avatar files" (see MANUAL_CHANGES.md) |
| INSERT | Uploading | Exists (uploads work); not documented here yet |
| DELETE | Deleting old photos, Remove Photo, account deletion | **To check.** Without it, deletes quietly do nothing. The app then logs "Removed 0 of N photo files" |

The trade-off of staying public: anyone who has a photo's URL can open it, with no
expiry. The URLs contain the user's ID and a timestamp, so they can't be guessed,
and the policies stop anyone from listing other users' files. A private bucket with
signed URLs would close that gap, at the cost of one extra request per photo shown
and links that expire.

## Password reset: redirect URLs and the email

The app asks Supabase to send reset links to `Linking.createURL('reset-password')`
(`resetPasswordRedirectUrl` in `src/context/AuthContext.tsx`). That is:

| Where the app runs | Redirect URL |
|---|---|
| Store, TestFlight, preview and development builds | `numo://reset-password` (`numo` is the scheme in `app.json`) |
| Expo Go | `exp://<computer's LAN IP>:8081/--/reset-password` |

**Authentication → URL Configuration → Redirect URLs** must list:
- `numo://reset-password`: always.
- `exp://**`: only while testing in Expo Go. Remove it before launch, or keep it
  only on a separate test project.

If the redirect URL isn't listed, Supabase silently sends the user to the **Site
URL** instead, and the link opens a browser rather than the app. The Site URL
itself doesn't matter for resets.

**The email (Authentication → Emails → Reset Password).** The app handles all of these:
- the code `{{ .Token }}`, typed on the reset screen;
- the default link `{{ .ConfirmationURL }}`, which Supabase checks and then opens
  `numo://reset-password#access_token=…`;
- a direct link `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`,
  which the app checks itself.

Recommended: the code plus the default link. The code works on any device, even
when the email is read on a computer. The default link is an `https://` link,
which every mail app opens. A direct `numo://` link avoids one weakness of the
default link: email security scanners that "pre-click" links can use it up before
the user taps it. But some mail apps (e.g. Gmail) don't open custom-scheme
links, so it isn't the default here.

```html
<h2>Reset your NUMO password</h2>
<p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
<p>Or, on your phone, <a href="{{ .ConfirmationURL }}">tap here to reset it in the NUMO app</a>.</p>
<p>The code and link expire after a while and work once. If you didn't ask for this, ignore this email.</p>
```

How long codes and links last is set under **Authentication → Providers → Email
→ Email OTP Expiration** (default 1 hour). The same setting covers both.

## Setting up the CLI later

The CLI is already installed as a dev dependency (`npx supabase`). Setting it up
needs a Supabase access token (`npx supabase login`), the project ref (Dashboard →
Project Settings → General) and the database password, and Docker running:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db pull
npx supabase db pull --schema auth,storage   # triggers on auth.users, storage policies
```

After that, make backend changes as migrations (`npx supabase migration new`,
review locally with `npx supabase db reset`, apply with `npx supabase db push`)
instead of in the dashboard.
