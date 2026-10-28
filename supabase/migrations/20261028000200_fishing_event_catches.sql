alter table public.events
  add column start_at timestamptz,
  add column end_at timestamptz,
  add constraint events_valid_time_range
    check (start_at is null or end_at is null or end_at >= start_at);

create table public.fish_species (
  id integer generated always as identity primary key,
  slug text not null unique,
  name_it text not null,
  name_en text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.event_catches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  species_id integer not null references public.fish_species(id),
  quantity integer not null default 1 check (quantity > 0),
  caught_on date,
  created_at timestamptz not null default now()
);

create index event_catches_event_id_idx on public.event_catches(event_id);
create index event_catches_species_id_idx on public.event_catches(species_id);

insert into public.fish_species (slug, name_it, name_en) values
  ('branzino', 'Branzino (spigola)', 'European seabass'),
  ('orata', 'Orata', 'Gilthead seabream'),
  ('cefalo', 'Cefalo (muggine)', 'Grey mullet'),
  ('anguilla', 'Anguilla', 'European eel'),
  ('passera', 'Passera', 'European flounder'),
  ('sogliola', 'Sogliola', 'Common sole'),
  ('ghiozzo', 'Ghiozzo', 'Goby'),
  ('sardina', 'Sardina', 'European pilchard'),
  ('acciuga', 'Acciuga', 'European anchovy'),
  ('gobione', 'Gobione', 'Common gudgeon')
on conflict (slug) do update set
  name_it = excluded.name_it,
  name_en = excluded.name_en,
  is_active = true;

alter table public.fish_species enable row level security;
alter table public.event_catches enable row level security;

create policy "Authenticated users can read active fish species"
  on public.fish_species for select to authenticated using (is_active);
create policy "Users can read catches on own events"
  on public.event_catches for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));
create policy "Users can create catches on own events"
  on public.event_catches for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));
create policy "Users can update catches on own events"
  on public.event_catches for update to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));
create policy "Users can delete catches on own events"
  on public.event_catches for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

revoke all on public.fish_species, public.event_catches from anon, authenticated;
grant select on public.fish_species to authenticated;
grant select, insert, update, delete on public.event_catches to authenticated;
