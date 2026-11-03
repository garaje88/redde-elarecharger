-- Reference connector types. Production data, so it lives in a migration rather than seed.sql.
-- ocm_id stays null until the phase 3 Open Charge Map importer matches each code.

insert into public.connector_types (code, name, current, max_kw_typical, compatible_adapters) values
  ('TYPE1',   'Tipo 1 (SAE J1772)',     'AC',   7.4, '{NACS}'),
  ('TYPE2',   'Tipo 2 (Mennekes)',      'AC',  22.0, '{}'),
  ('GBT_AC',  'GB/T AC',                'AC',   7.0, '{}'),
  ('CCS1',    'CCS Combo 1',            'DC', 350.0, '{NACS}'),
  ('CCS2',    'CCS Combo 2',            'DC', 350.0, '{}'),
  ('CHADEMO', 'CHAdeMO',                'DC', 100.0, '{}'),
  ('GBT_DC',  'GB/T DC',                'DC', 250.0, '{}'),
  ('NACS',    'NACS (SAE J3400)',       'DC', 250.0, '{TYPE1,CCS1}');
