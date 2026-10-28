alter table public.posts
  add column visibility text not null default 'public'
    check (visibility in ('public', 'friends', 'selected'));

create table public.post_audience (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_audience_user_id_idx on public.post_audience(user_id, post_id);
alter table public.post_audience enable row level security;

create or replace function public.is_accepted_friend(user_a uuid, user_b uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = user_a and f.friend_id = user_b)
        or (f.user_id = user_b and f.friend_id = user_a))
  );
$$;

create or replace function public.owns_post(target_post_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts p where p.id = target_post_id and p.author_id = auth.uid());
$$;

create or replace function public.can_read_post(target_post_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts p
    where p.id = target_post_id
      and (
        p.author_id = auth.uid()
        or p.visibility = 'public'
        or (p.visibility = 'friends' and public.is_accepted_friend(p.author_id, auth.uid()))
        or (p.visibility = 'selected' and exists (
          select 1 from public.post_audience a
          where a.post_id = p.id and a.user_id = auth.uid()
            and public.is_accepted_friend(p.author_id, auth.uid())
        ))
      )
  );
$$;

grant execute on function public.is_accepted_friend(uuid, uuid) to authenticated;
grant execute on function public.owns_post(uuid) to authenticated;
grant execute on function public.can_read_post(uuid) to authenticated;
revoke all on function public.is_accepted_friend(uuid, uuid) from public, anon;
revoke all on function public.owns_post(uuid) from public, anon;
revoke all on function public.can_read_post(uuid) from public, anon;

create policy "Authors and selected recipients can read post audiences"
  on public.post_audience for select to authenticated
  using (user_id = auth.uid() or public.owns_post(post_id));
create policy "Authors can select accepted friends for posts"
  on public.post_audience for insert to authenticated
  with check (
    added_by = auth.uid()
    and public.owns_post(post_id)
    and public.is_accepted_friend(auth.uid(), user_id)
  );
create policy "Authors can clear post audiences"
  on public.post_audience for delete to authenticated
  using (public.owns_post(post_id));
revoke all on public.post_audience from anon, authenticated;
grant select, insert, delete on public.post_audience to authenticated;

drop policy "Users can read posts" on public.posts;
create policy "Users can read posts according to visibility"
  on public.posts for select to authenticated
  using (public.can_read_post(id));

drop policy "Authenticated users can read post attachments" on public.post_attachments;
create policy "Users can read attachments for visible posts"
  on public.post_attachments for select to authenticated
  using (public.can_read_post(post_id));

drop policy "Authenticated users can view feed media" on storage.objects;
create policy "Users can view media for visible posts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'lagoon-feed-media'
    and exists (
      select 1 from public.posts p
      where p.id::text = (storage.foldername(name))[2]
        and public.can_read_post(p.id)
    )
  );
