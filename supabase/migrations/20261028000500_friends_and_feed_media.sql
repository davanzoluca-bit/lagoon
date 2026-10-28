create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (user_id <> friend_id),
  check ((status = 'pending' and accepted_at is null) or (status = 'accepted' and accepted_at is not null))
);
create unique index friendships_unique_pair_idx on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));
create index friendships_friend_id_status_idx on public.friendships(friend_id, status);
create index friendships_user_id_status_idx on public.friendships(user_id, status);

alter table public.friendships enable row level security;
create policy "Users can read their friend requests and friendships"
  on public.friendships for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());
create policy "Users can send friend requests"
  on public.friendships for insert to authenticated
  with check (user_id = auth.uid() and friend_id <> auth.uid() and status = 'pending' and accepted_at is null);
create policy "Recipients can accept friend requests"
  on public.friendships for update to authenticated
  using (friend_id = auth.uid() and status = 'pending')
  with check (friend_id = auth.uid() and status = 'accepted' and accepted_at is not null);
create policy "Participants can remove friend requests or friendships"
  on public.friendships for delete to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());
revoke all on public.friendships from anon, authenticated;
grant select, insert, delete on public.friendships to authenticated;
grant update(status, accepted_at) on public.friendships to authenticated;

alter table public.posts drop constraint posts_body_check;
alter table public.posts add constraint posts_body_length_check check (char_length(body) <= 5000);

drop policy "Event owners can add participants" on public.event_participants;
create policy "Event owners can add friends to events"
  on public.event_participants for insert to authenticated
  with check (
    invited_by = auth.uid()
    and public.is_event_owner(event_id)
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = public.event_participants.user_id)
          or (f.friend_id = auth.uid() and f.user_id = public.event_participants.user_id))
    )
  );

drop policy "Users can read events shared with them" on public.events;
create policy "Friends can read events shared with them"
  on public.events for select to authenticated
  using (
    exists (select 1 from public.event_participants p where p.event_id = id and p.user_id = auth.uid())
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = owner_id)
          or (f.friend_id = auth.uid() and f.user_id = owner_id))
    )
  );
drop policy "Users can read catches on events shared with them" on public.event_catches;
create policy "Friends can read catches on shared events"
  on public.event_catches for select to authenticated
  using (
    exists (
      select 1 from public.event_participants p
      join public.events e on e.id = p.event_id
      where p.event_id = public.event_catches.event_id and p.user_id = auth.uid()
        and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and ((f.user_id = auth.uid() and f.friend_id = e.owner_id)
              or (f.friend_id = auth.uid() and f.user_id = e.owner_id))
        )
    )
  );
drop policy "Users can read attachments on events shared with them" on public.event_attachments;
create policy "Friends can read attachments on shared events"
  on public.event_attachments for select to authenticated
  using (
    exists (
      select 1 from public.event_participants p
      join public.events e on e.id = p.event_id
      where p.event_id = public.event_attachments.event_id and p.user_id = auth.uid()
        and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and ((f.user_id = auth.uid() and f.friend_id = e.owner_id)
              or (f.friend_id = auth.uid() and f.user_id = e.owner_id))
        )
    )
  );
drop policy "Users can read storage files on events shared with them" on storage.objects;
create policy "Friends can read storage files on shared events"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'lagoon-attachments'
    and exists (
      select 1 from public.event_participants p
      join public.events e on e.id = p.event_id
      join public.friendships f on f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = e.owner_id)
          or (f.friend_id = auth.uid() and f.user_id = e.owner_id))
      where p.user_id = auth.uid()
        and p.event_id::text = (storage.foldername(name))[2]
    )
  );

create table public.post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name text not null,
  object_path text not null unique,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create index post_attachments_post_id_idx on public.post_attachments(post_id);
alter table public.post_attachments enable row level security;
create policy "Authenticated users can read post attachments"
  on public.post_attachments for select to authenticated using (true);
create policy "Authors can add attachments to own posts"
  on public.post_attachments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy "Authors can delete attachments from own posts"
  on public.post_attachments for delete to authenticated
  using (author_id = auth.uid());
revoke all on public.post_attachments from anon, authenticated;
grant select, insert, delete on public.post_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lagoon-feed-media', 'lagoon-feed-media', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "Authenticated users can view feed media"
  on storage.objects for select to authenticated
  using (bucket_id = 'lagoon-feed-media');
create policy "Users can upload media to own feed posts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'lagoon-feed-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete media from own feed posts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'lagoon-feed-media' and (storage.foldername(name))[1] = auth.uid()::text);
