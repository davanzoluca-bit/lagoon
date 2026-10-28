create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null,
  event_date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);
create table public.event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name text not null,
  object_path text not null,
  content_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_attachments enable row level security;
alter table public.posts enable row level security;
alter table public.messages enable row level security;

create policy "Users can read profiles" on public.profiles for select to authenticated using (true);
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Users can read own events" on public.events for select to authenticated using (owner_id = auth.uid());
create policy "Users can create own events" on public.events for insert to authenticated with check (owner_id = auth.uid());
create policy "Users can update own events" on public.events for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Users can delete own events" on public.events for delete to authenticated using (owner_id = auth.uid());
create policy "Users can manage own event attachments" on public.event_attachments for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));
create policy "Users can read posts" on public.posts for select to authenticated using (true);
create policy "Users can create own posts" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "Users can delete own posts" on public.posts for delete to authenticated using (author_id = auth.uid());
create policy "Users can read own messages" on public.messages for select to authenticated using (sender_id = auth.uid());
create policy "Users can create own messages" on public.messages for insert to authenticated with check (sender_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit) values ('lagoon-attachments', 'lagoon-attachments', false, 52428800) on conflict (id) do nothing;
create policy "Users can upload own attachments" on storage.objects for insert to authenticated with check (bucket_id = 'lagoon-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can read own attachments" on storage.objects for select to authenticated using (bucket_id = 'lagoon-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own attachments" on storage.objects for delete to authenticated using (bucket_id = 'lagoon-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

revoke all on public.profiles, public.events, public.event_attachments, public.posts, public.messages from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, delete on public.event_attachments to authenticated;
grant select, insert, delete on public.posts to authenticated;
grant select, insert on public.messages to authenticated;
