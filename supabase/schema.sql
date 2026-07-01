-- =========================================================
-- Turkistan CCGT — Cable Dashboard
-- Database schema (idempotent — safe to re-run)
-- =========================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Then click "Run"

-- =========================================================
-- 1) cable_actuals (케이블별 실적)
-- =========================================================
create table if not exists public.cable_actuals (
  cable_no       text primary key,
  vendor         text,
  pulled_length  text,
  used_drum      text,
  pulled_by      text,
  pulling_date   date,
  term_date_from date,
  term_by_from   text,
  term_date_to   date,
  term_by_to     text,
  lc             text default 'Pending' check (lc in ('Pending','In Progress','Done')),
  act            text,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null
);

-- =========================================================
-- 2) daily_manpower (날짜×업체 인원)
-- =========================================================
create table if not exists public.daily_manpower (
  id             bigserial primary key,
  work_date      date not null,
  vendor         text not null,
  pull_manpower  text,
  term_manpower  text,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null,
  unique (work_date, vendor)
);

-- =========================================================
-- 3) updated_at 자동 갱신 트리거
-- =========================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists cable_actuals_touch  on public.cable_actuals;
drop trigger if exists daily_manpower_touch on public.daily_manpower;

create trigger cable_actuals_touch
  before update on public.cable_actuals
  for each row execute function public.touch_updated_at();

create trigger daily_manpower_touch
  before update on public.daily_manpower
  for each row execute function public.touch_updated_at();

-- =========================================================
-- 4a) GRANTS — "Automatically expose new tables"를 꺼두었기 때문에
--     명시적으로 authenticated 롤에 권한을 줘야 합니다.
-- =========================================================
grant select, insert, update, delete on public.cable_actuals  to authenticated;
grant select, insert, update, delete on public.daily_manpower to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- =========================================================
-- 4b) RLS — 로그인 사용자는 모두 읽기·쓰기 가능
--    (Vendor 필드로 추적, 나중에 회사별 제한 강화 가능)
-- =========================================================
alter table public.cable_actuals  enable row level security;
alter table public.daily_manpower enable row level security;

drop policy if exists "authenticated_all" on public.cable_actuals;
drop policy if exists "authenticated_all" on public.daily_manpower;

create policy "authenticated_all" on public.cable_actuals
  for all to authenticated using (true) with check (true);

create policy "authenticated_all" on public.daily_manpower
  for all to authenticated using (true) with check (true);

-- =========================================================
-- 5) Realtime — 다른 사용자의 변경 사항 실시간 반영
-- =========================================================
do $$ begin
  alter publication supabase_realtime add table public.cable_actuals;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.daily_manpower;
exception when duplicate_object then null;
end $$;

-- =========================================================
-- 완료. Table Editor에서 cable_actuals / daily_manpower 두 테이블 확인.
-- =========================================================
