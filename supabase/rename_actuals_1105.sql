-- I&C BOP schedule C02/C03 (05.11.26): DC/UPS interface cables were renumbered.
-- Moves the site actuals (pulling / termination / line check) to the new cable numbers
-- so the progress is not lost. Run in the Supabase SQL Editor. Safe to re-run:
-- a row is only moved when the new number has no actuals yet.
--   DCP-64701-C6001  -> CH-64701-C6001
--   UPSP-64701-C6001 -> AVR-64701-C6001
--   UPSP-64701-C6002 -> AVR-64702-C6001
-- (DCP-64701-C6002 is struck in the new schedule but already pulled — it stays as it is.)

with m(old_no, new_no) as (values
  ('B0-DCP-64701-C6001',  'B0-CH-64701-C6001'),
  ('B0-UPSP-64701-C6001', 'B0-AVR-64701-C6001'),
  ('B0-UPSP-64701-C6002', 'B0-AVR-64702-C6001'),
  ('B1-DCP-64701-C6001',  'B1-CH-64701-C6001'),
  ('B1-UPSP-64701-C6001', 'B1-AVR-64701-C6001'),
  ('B1-UPSP-64701-C6002', 'B1-AVR-64702-C6001'),
  ('B2-DCP-64701-C6001',  'B2-CH-64701-C6001'),
  ('B2-UPSP-64701-C6001', 'B2-AVR-64701-C6001'),
  ('B2-UPSP-64701-C6002', 'B2-AVR-64702-C6001')
)
update public.cable_actuals a
set cable_no = m.new_no, updated_at = now()
from m
where a.cable_no = m.old_no
  and not exists (select 1 from public.cable_actuals b where b.cable_no = m.new_no);

-- check: the new numbers should carry the actuals, the old ones should be gone
select cable_no, vendor, pulling_date, pulled_length, term_date_from, term_date_to, lc
from public.cable_actuals
where cable_no ~ '^B[012]-(DCP|UPSP|CH|AVR)-6470'
order by cable_no;
