alter table public.event_catches
  add column caught_time time,
  add column latitude double precision,
  add column longitude double precision,
  add constraint event_catches_valid_position
    check (
      (latitude is null and longitude is null)
      or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
    );
