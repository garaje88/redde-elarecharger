-- Local development seed only (runs on `supabase db reset`). The real catalog comes from the
-- phase 3 importers. Values below come from the example sheet in docs/reference.

insert into public.ev_brands (id, name, slug, country) values
  ('0b8f6a4e-0000-4000-8000-000000000001', 'Deepal', 'deepal', 'CN');

insert into public.ev_models (id, brand_id, name, slug, body_type, markets, aliases) values
  ('0b8f6a4e-0000-4000-8000-000000000002', '0b8f6a4e-0000-4000-8000-000000000001',
   'S05', 's05', 'suv', '{CO}', '{S-05,"Deepal S05"}');

insert into public.ev_variants (
  id, model_id, year_from, trim, battery_gross_kwh, battery_usable_kwh, chemistry,
  range_km, range_cycle, field_sources, status
) values (
  '0b8f6a4e-0000-4000-8000-000000000003', '0b8f6a4e-0000-4000-8000-000000000002',
  2026, 'E-Max', 56.12, 56.12, 'LFP', 458, 'NEDC',
  '{"battery_gross_kwh": {"source": "ficha técnica", "confidence": 1},
    "range_km": {"source": "ficha técnica", "confidence": 1}}',
  'verified'
);
