create table public.weather_stations (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  area text not null,
  latitude double precision not null,
  longitude double precision not null,
  source_url text not null,
  source_license text not null,
  source_time_basis text not null,
  vertical_datum text not null,
  created_at timestamptz not null default now()
);

create table public.weather_observations (
  station_id uuid not null references public.weather_stations(id) on delete cascade,
  recorded_at timestamp without time zone not null,
  tide_level_m numeric(5, 2),
  water_temp_c numeric(4, 1),
  primary key (station_id, recorded_at),
  constraint weather_observations_has_value check (tide_level_m is not null or water_temp_c is not null)
);

create index weather_observations_recorded_at_idx
  on public.weather_observations (recorded_at desc);

alter table public.weather_stations enable row level security;
alter table public.weather_observations enable row level security;

revoke all on public.weather_stations, public.weather_observations from anon, authenticated;
grant select on public.weather_stations, public.weather_observations to authenticated;

create policy "Authenticated users can read weather stations"
  on public.weather_stations for select to authenticated using (true);
create policy "Authenticated users can read weather observations"
  on public.weather_observations for select to authenticated using (true);

insert into public.weather_stations (
  id, slug, name, area, latitude, longitude, source_url,
  source_license, source_time_basis, vertical_datum
) values (
  '590ab8d1-c1f1-4e11-913d-a13fb45ef3d7',
  'punta-salute-canal-grande',
  'Punta Salute Canal Grande',
  'Canal Grande',
  45.4310778,
  12.3363778,
  'https://www.comune.venezia.it/it/content/1-punta-salute-canal-grande',
  'CC-BY (Comune di Venezia / Centro Maree)',
  'UTC+01:00 solar time, year-round',
  'Zero Mareografico Punta della Salute 1897 (ZMPS)'
)
on conflict (slug) do update set
  name = excluded.name,
  area = excluded.area,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  source_url = excluded.source_url,
  source_license = excluded.source_license,
  source_time_basis = excluded.source_time_basis,
  vertical_datum = excluded.vertical_datum;
