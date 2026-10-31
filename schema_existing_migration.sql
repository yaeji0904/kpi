-- 기존 public.kpi_records를 위한 보존형 변경 예시입니다.
-- 실제 DB에는 실행하지 않았습니다. 기존 테이블/정책/데이터와 일치하는지 먼저 검토하세요.
-- 이 파일은 행을 삭제하거나 기존 테이블을 재생성하지 않습니다.
-- 아래 마이그레이션은 이 실습앱의 이전 스키마처럼 기본 열(id,user_id,month,team,target,actual,created_at)이 있는 경우를 전제로 합니다.
-- user_id가 없거나 형식이 다르면 사용자 소유자를 추측해 채우지 말고, 적용을 중단해 수동 설계하세요.

-- 1) 읽기 전용 사전 점검. 예상하지 못한 열 형식, 중복, 잘못된 행은 먼저 해결 계획을 세우세요.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'kpi_records'
order by ordinal_position;

select user_id, month, team, count(*) as duplicate_count
from public.kpi_records
group by user_id, month, team
having count(*) > 1;

select id, user_id, month, team, target, actual, created_at
from public.kpi_records
where id is null or user_id is null or created_at is null
   or month is null or month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
   or team is null or length(team) not between 1 and 80
   or team ~ '^[[:space:]]|[[:space:]]$'
   or target is null or target not between 0 and 9007199254740991
   or actual is null or actual not between 0 and 9007199254740991;

-- 2) 실행 전 pg_policies에서 기존 정책을 검토합니다.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'kpi_records'
order by policyname;

-- 3) 변경 구간: 위 결과를 확인하고 기존 스키마가 전제와 맞을 때만 별도로 검토하세요.
begin;

do $$
declare
  expected record;
begin
  if to_regclass('public.kpi_records') is null then
    raise exception 'public.kpi_records가 없습니다. 신규 DB에는 schema.sql을 검토하세요.';
  end if;
  if to_regclass('auth.users') is null then
    raise exception 'auth.users가 없습니다. Supabase Auth 스키마를 먼저 확인하세요.';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'kpi_records'
      and policyname not in (
        'kpi_select_own', 'kpi_insert_own', 'kpi_update_own', 'kpi_delete_own',
        'kpi_records_select_own', 'kpi_records_insert_own',
        'kpi_records_update_own', 'kpi_records_delete_own'
      )
  ) then
    raise exception '알려지지 않은 RLS 정책이 있습니다. 본인 행 전용 여부를 검토한 뒤 진행하세요.';
  end if;

  for expected in
    select * from (values
      ('id', 'uuid'), ('user_id', 'uuid'), ('month', 'text'),
      ('team', 'text'), ('target', 'bigint'), ('actual', 'bigint'),
      ('created_at', 'timestamp with time zone')
    ) as v(column_name, data_type)
  loop
    if not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'kpi_records'
        and c.column_name = expected.column_name
        and c.data_type = expected.data_type
    ) then
      raise exception '필수 열 또는 형식이 예상과 다릅니다: %.%', 'kpi_records', expected.column_name;
    end if;
  end loop;

  if exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'kpi_records'
      and c.column_name = 'source_id' and c.data_type <> 'text'
  ) then
    raise exception 'source_id의 자료형이 text가 아닙니다. 자동 변환하지 않습니다.';
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.kpi_records'::regclass and c.contype = 'p'
      and (select array_agg(a.attname::text order by a.attname::text)
           from unnest(c.conkey) key(attnum)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum)
          = array['id']::text[]
  ) then
    raise exception 'id 기본 키가 예상과 다릅니다. 자동 재구성하지 않습니다.';
  end if;

  if exists (
    select 1 from public.kpi_records
    where id is null or user_id is null or created_at is null or month is null
       or month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
       or team is null or length(team) not between 1 and 80
       or team ~ '^[[:space:]]|[[:space:]]$'
       or target is null or target not between 0 and 9007199254740991
       or actual is null or actual not between 0 and 9007199254740991
  ) then
    raise exception '기존 행에 필수값/범위 위반이 있습니다. 데이터를 삭제하지 말고 먼저 검토하세요.';
  end if;

  if exists (
    select 1 from public.kpi_records
    group by user_id, month, team having count(*) > 1
  ) then
    raise exception '(user_id, month, team) 중복 행이 있습니다. 임의 삭제 없이 병합 방식을 먼저 정하세요.';
  end if;
end $$;

alter table public.kpi_records
  add column if not exists source_id text;

-- source_id가 이미 있으면 그 값도 사용자별로 중복되지 않는지 검사합니다.
do $$
begin
  if exists (
    select 1 from public.kpi_records
    where source_id is not null
    group by user_id, source_id having count(*) > 1
  ) then
    raise exception '(user_id, source_id) 중복이 있습니다. 임의 수정·삭제 없이 먼저 검토하세요.';
  end if;
end $$;

alter table public.kpi_records
  alter column id set default gen_random_uuid(),
  alter column user_id set default auth.uid(),
  alter column created_at set default now(),
  alter column id set not null,
  alter column user_id set not null,
  alter column month set not null,
  alter column team set not null,
  alter column target set not null,
  alter column actual set not null,
  alter column created_at set not null;

-- Auth 사용자 참조가 없으면 기존 user_id를 검증한 뒤 FK를 추가합니다.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.kpi_records'::regclass and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and (select array_agg(a.attname::text order by a.attname::text)
           from unnest(c.conkey) key(attnum)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum)
          = array['user_id']::text[]
      and (select array_agg(a.attname::text order by a.attname::text)
           from unnest(c.confkey) key(attnum)
           join pg_attribute a on a.attrelid = c.confrelid and a.attnum = key.attnum)
          = array['id']::text[]
  ) then
    alter table public.kpi_records
      add constraint kpi_records_user_fk_migration
      foreign key (user_id) references auth.users(id) not valid;
    alter table public.kpi_records
      validate constraint kpi_records_user_fk_migration;
  end if;
end $$;

-- 이름이 다른 기존 UNIQUE 제약도 열 구성이 같으면 재사용합니다.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.kpi_records'::regclass and c.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname::text)
           from unnest(c.conkey) key(attnum)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum)
          = array['month','team','user_id']::text[]
  ) then
    alter table public.kpi_records
      add constraint kpi_records_user_month_team_unique unique (user_id, month, team);
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.kpi_records'::regclass and c.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname::text)
           from unnest(c.conkey) key(attnum)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum)
          = array['source_id','user_id']::text[]
  ) then
    alter table public.kpi_records
      add constraint kpi_records_user_source_unique unique (user_id, source_id);
  end if;
end $$;

-- 기존 행은 앞의 검사에서 확인했습니다. 새 행에도 규칙을 적용합니다.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.kpi_records'::regclass and conname = 'kpi_records_month_format_migration') then
    alter table public.kpi_records add constraint kpi_records_month_format_migration
      check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.kpi_records'::regclass and conname = 'kpi_records_team_format_migration') then
    alter table public.kpi_records add constraint kpi_records_team_format_migration
      check (length(team) between 1 and 80 and team !~ '^[[:space:]]|[[:space:]]$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.kpi_records'::regclass and conname = 'kpi_records_target_safe_integer_migration') then
    alter table public.kpi_records add constraint kpi_records_target_safe_integer_migration
      check (target between 0 and 9007199254740991);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.kpi_records'::regclass and conname = 'kpi_records_actual_safe_integer_migration') then
    alter table public.kpi_records add constraint kpi_records_actual_safe_integer_migration
      check (actual between 0 and 9007199254740991);
  end if;
end $$;

alter table public.kpi_records enable row level security;
revoke all on public.kpi_records from anon;
grant select, insert, update, delete on public.kpi_records to authenticated;

-- 아래 이름은 프로젝트가 제공한 두 schema.sql 버전의 정책 이름입니다.
-- 같은 이름의 사용자 정의 정책이 있으면 이 블록을 실행하지 말고 먼저 검토하세요.
drop policy if exists kpi_select_own on public.kpi_records;
drop policy if exists kpi_insert_own on public.kpi_records;
drop policy if exists kpi_update_own on public.kpi_records;
drop policy if exists kpi_delete_own on public.kpi_records;
drop policy if exists kpi_records_select_own on public.kpi_records;
drop policy if exists kpi_records_insert_own on public.kpi_records;
drop policy if exists kpi_records_update_own on public.kpi_records;
drop policy if exists kpi_records_delete_own on public.kpi_records;

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
