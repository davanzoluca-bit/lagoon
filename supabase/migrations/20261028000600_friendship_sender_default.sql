-- Set the authenticated sender automatically for friend requests.
-- Existing clients may still provide user_id explicitly; the INSERT policy
-- continues to ensure it matches auth.uid().
alter table public.friendships
  alter column user_id set default auth.uid();
