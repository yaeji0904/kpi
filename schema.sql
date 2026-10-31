-- 새 Supabase 프로젝트용 초기 스키마입니다.
-- 실제 DB에는 실행하지 않았습니다. 기존 테이블을 삭제하거나 덮어쓰지 않습니다.
-- 기존 DB에는 schema_existing_migration.sql의 사전 검토 절차를 사용하세요.
begin;

create table public.kpi_records (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  source_id text,
  month text not null,
  team text not null,
  target bigint not null,
  actual bigint not null,
  created_at timestamptz not null default now(),

  constraint kpi_records_pkey primary key (id),
  constraint kpi_records_user_fk foreign key (user_id) references auth.users(id),
  constraint kpi_records_month_format check (
    month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  ),
  constraint kpi_records_team_format check (
    length(team) between 1 and 80
    and team !~ '^[[:space:]]|[[:space:]]$'
  ),
  constraint kpi_records_target_safe_integer check (
    target between 0 and 9007199254740991
  ),
  constraint kpi_records_actual_safe_integer check (
    actual between 0 and 9007199254740991
  ),
  constraint kpi_records_user_month_team_unique unique (user_id, month, team),
  constraint kpi_records_user_source_unique unique (user_id, source_id)
);

alter table public.kpi_records enable row level security;
revoke all on public.kpi_records from anon;
grant select, insert, update, delete on public.kpi_records to authenticated;

create policy kpi_records_select_own
  on public.kpi_records for select to authenticated
  using ((select auth.uid()) = user_id);

create policy kpi_records_insert_own
  on public.kpi_records for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy kpi_records_update_own
  on public.kpi_records for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy kpi_records_delete_own
  on public.kpi_records for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
