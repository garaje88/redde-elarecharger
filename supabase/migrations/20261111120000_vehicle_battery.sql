-- Battery level the owner reports for a vehicle ("Batería actual"). The app does not read the car,
-- so the value is only as fresh as current_soc_at; both are set together or both are null.

alter table public.vehicles
  add column current_soc numeric(5, 2) check (current_soc between 0 and 100),
  add column current_soc_at timestamptz,
  add constraint vehicles_current_soc_pair check ((current_soc is null) = (current_soc_at is null));

comment on column public.vehicles.current_soc is
  'Battery % the owner last reported; trips and charges start from it.';
comment on column public.vehicles.current_soc_at is 'When current_soc was reported.';
