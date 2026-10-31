# Manual changes to the hosted Supabase project

Changes made by hand in the Supabase dashboard, since the CLI isn't set up yet.
Each one is recorded with SQL that has the same effect. **All of these are already
applied. Don't run them again.** When the CLI is set up, `supabase db pull` will
capture the resulting state, and this file can then be trimmed.

The SQL below is written from the description of each change, not copied from the
dashboard. If the two ever disagree, the dashboard is right.

---

## 2026-10-31: Removed the unused `delete_user_account` function

The app deletes accounts with `public.delete_user()` (Settings → Delete Account),
which is unchanged. `delete_user_account` was a redundant second function that
nothing called.

```sql
drop function if exists public.delete_user_account;
```

## 2026-10-31: Avatars: only the owner can read or list their files

The `avatars` bucket **stays public**: photos are shown through their public URLs
(`.../storage/v1/object/public/avatars/<user id>/...`), which bypass these policies.
What changed is the API: a signed-in user can no longer list or read other users'
files there. Before, the two policies below let anyone list every user's photos.

Dropped (original definitions weren't recorded):

```sql
drop policy "Public Avatar Access" on storage.objects;
drop policy "Allow authenticated read avatars" on storage.objects;
```

Added:

```sql
create policy "Users can read own avatar files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```
