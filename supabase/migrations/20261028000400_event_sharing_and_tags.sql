alter table public.events
  add column tags text[] not null default '{}',
  add constraint events_tags_valid
    check (cardinality(tags) <= 20 and array_position(tags, '') is null);

create index events_tags_gin_idx on public.events using gin (tags);

create table public.event_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id),
  check (invited_by <> user_id)
);
create index event_participants_user_id_idx on public.event_participants(user_id, event_id);

alter table public.event_participants enable row level security;

create function public.is_event_owner(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = target_event_id and e.owner_id = auth.uid()
  );
$$;
revoke all on function public.is_event_owner(uuid) from public, anon;
grant execute on function public.is_event_owner(uuid) to authenticated;

create policy "Users can read event participants they share or own"
  on public.event_participants for select to authenticated
  using (user_id = auth.uid() or public.is_event_owner(event_id));
create policy "Event owners can add participants"
  on public.event_participants for insert to authenticated
  with check (invited_by = auth.uid() and public.is_event_owner(event_id));
create policy "Event owners can remove participants"
  on public.event_participants for delete to authenticated
  using (public.is_event_owner(event_id));

create policy "Users can read events shared with them"
  on public.events for select to authenticated
  using (exists (select 1 from public.event_participants p where p.event_id = id and p.user_id = auth.uid()));
create policy "Users can read catches on events shared with them"
  on public.event_catches for select to authenticated
  using (exists (select 1 from public.event_participants p where p.event_id = event_id and p.user_id = auth.uid()));
create policy "Users can read attachments on events shared with them"
  on public.event_attachments for select to authenticated
  using (exists (select 1 from public.event_participants p where p.event_id = event_id and p.user_id = auth.uid()));
create policy "Users can read storage files on events shared with them"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'lagoon-attachments'
    and exists (
      select 1 from public.event_participants p
      where p.user_id = auth.uid()
        and p.event_id::text = (storage.foldername(name))[2]
    )
  );

revoke all on public.event_participants from anon, authenticated;
grant select, insert, delete on public.event_participants to authenticated;
