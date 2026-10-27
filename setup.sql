-- =====================================================================
--  PSYCHOLOGY Platform — база данных
--  Вставить целиком в Supabase → SQL Editor → New query → Run (один раз)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Типы ----------
do $$ begin
  create type public.user_role as enum ('admin', 'teacher', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.access_status as enum ('active', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('paid', 'unpaid');
exception when duplicate_object then null; end $$;

-- ---------- Таблицы ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  first_name text,
  last_name text,
  middle_name text,
  email text,
  phone text,
  status text not null default 'active',
  teacher_id uuid references public.profiles(id) on delete set null,
  school_id uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  restored_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.access_periods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.access_status not null default 'active',
  payment_status public.payment_status not null default 'paid',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_unlimited boolean not null default true,
  granted_scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists access_periods_profile_idx on public.access_periods(profile_id, created_at desc);

create table if not exists public.account_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  first_name text,
  last_name text,
  role text,
  registered_at timestamptz,
  event text not null,
  event_at timestamptz not null default now(),
  actor_id uuid
);

-- Трекер привычек
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits(user_id);

create table if not exists public.habit_checks (
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day)
);
create index if not exists habit_checks_user_idx on public.habit_checks(user_id, day);

-- ---------- Служебные функции ----------
create or replace function public.get_my_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function public.get_my_teacher_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select teacher_id from public.profiles where id = auth.uid(); $$;

-- Новый пользователь: создаём профиль. Самый первый зарегистрированный становится администратором.
-- Если при регистрации указан код учителя — сразу прикрепляем к учителю.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.user_role := 'student';
  v_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'teacher_code', '')));
  v_teacher uuid;
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    v_role := 'admin';
  end if;
  if v_code <> '' then
    select id into v_teacher from public.profiles
    where role = 'teacher' and upper(left(id::text, 8)) = v_code and status <> 'deleted'
    limit 1;
  end if;
  insert into public.profiles (id, role, first_name, last_name, middle_name, email, phone, teacher_id)
  values (
    new.id, v_role,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.raw_user_meta_data ->> 'middle_name',
    new.email,
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone),
    v_teacher
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Защита: обычный пользователь не может сам поменять себе роль, статус или учителя.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;              -- SQL Editor / сервер
  if public.get_my_role() = 'admin' then return new; end if;  -- администратор может всё
  new.role := old.role;
  new.status := old.status;
  new.teacher_id := old.teacher_id;
  new.deleted_at := old.deleted_at;
  new.deleted_by := old.deleted_by;
  new.restored_at := old.restored_at;
  new.email := old.email;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Ученик вводит код учителя в разделе «Доступ»
create or replace function public.apply_teacher_code(p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_teacher uuid;
begin
  if auth.uid() is null then return false; end if;
  select id into v_teacher from public.profiles
  where role = 'teacher' and upper(left(id::text, 8)) = upper(trim(coalesce(p_code, ''))) and status <> 'deleted'
  limit 1;
  if v_teacher is null or v_teacher = auth.uid() then return false; end if;
  update public.profiles set teacher_id = v_teacher where id = auth.uid() and teacher_id is null;
  return true;
end;
$$;

-- Удаление / восстановление аккаунта (администратор — любой, учитель — только свои ученики)
create or replace function public.manage_user_account(p_user_id uuid, p_action text)
returns text
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_role public.user_role;
  t record;
begin
  if v_caller is null then raise exception 'Нужно войти в аккаунт'; end if;
  select role into v_caller_role from public.profiles where id = v_caller;
  if v_caller_role not in ('admin', 'teacher') then raise exception 'Недостаточно прав'; end if;
  if p_user_id = v_caller then raise exception 'Нельзя выполнить это действие со своим аккаунтом'; end if;

  select * into t from public.profiles where id = p_user_id;
  if t.id is null then raise exception 'Пользователь не найден'; end if;
  if v_caller_role = 'teacher' and (t.teacher_id is distinct from v_caller or t.role <> 'student') then
    raise exception 'Вы можете управлять только своими учениками';
  end if;
  if t.role = 'admin' then raise exception 'Аккаунт администратора удалить нельзя'; end if;

  if p_action = 'restore' then
    if t.status <> 'deleted' then raise exception 'Аккаунт и так активен'; end if;
    update auth.users set banned_until = null where id = p_user_id;
    update public.profiles set status = 'active', restored_at = now(), deleted_by = null where id = p_user_id;
    insert into public.account_events (user_id, email, first_name, last_name, role, registered_at, event, actor_id)
    values (p_user_id, t.email, t.first_name, t.last_name, t.role::text, t.created_at, 'restored', v_caller);
    return 'restored';
  end if;

  update auth.users set banned_until = now() + interval '100 years' where id = p_user_id;
  update public.profiles set status = 'deleted', deleted_at = now(), deleted_by = v_caller where id = p_user_id;
  insert into public.account_events (user_id, email, first_name, last_name, role, registered_at, event, actor_id)
  values (p_user_id, t.email, t.first_name, t.last_name, t.role::text, t.created_at, 'deleted', v_caller);
  return 'deleted';
end;
$$;

-- ---------- Права доступа к таблицам (RLS) ----------
alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.access_periods enable row level security;
alter table public.account_events enable row level security;
alter table public.habits enable row level security;
alter table public.habit_checks enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');
drop policy if exists profiles_teacher_select_students on public.profiles;
create policy profiles_teacher_select_students on public.profiles for select using (teacher_id = auth.uid());
drop policy if exists profiles_student_select_teacher on public.profiles;
create policy profiles_student_select_teacher on public.profiles for select
  using (id = public.get_my_teacher_id());

drop policy if exists schools_read on public.schools;
create policy schools_read on public.schools for select using (auth.uid() is not null);
drop policy if exists schools_owner_insert on public.schools;
create policy schools_owner_insert on public.schools for insert with check (owner_id = auth.uid());
drop policy if exists schools_owner_update on public.schools;
create policy schools_owner_update on public.schools for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists schools_admin_all on public.schools;
create policy schools_admin_all on public.schools for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

drop policy if exists access_periods_self_select on public.access_periods;
create policy access_periods_self_select on public.access_periods for select using (profile_id = auth.uid());
drop policy if exists access_periods_admin_all on public.access_periods;
create policy access_periods_admin_all on public.access_periods for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');
drop policy if exists access_periods_teacher_select on public.access_periods;
create policy access_periods_teacher_select on public.access_periods for select
  using (exists (select 1 from public.profiles s where s.id = access_periods.profile_id and s.teacher_id = auth.uid()));
drop policy if exists access_periods_teacher_insert on public.access_periods;
create policy access_periods_teacher_insert on public.access_periods for insert
  with check (exists (select 1 from public.profiles s where s.id = access_periods.profile_id and s.teacher_id = auth.uid()));
drop policy if exists access_periods_teacher_update on public.access_periods;
create policy access_periods_teacher_update on public.access_periods for update
  using (exists (select 1 from public.profiles s where s.id = access_periods.profile_id and s.teacher_id = auth.uid()));

drop policy if exists account_events_admin_all on public.account_events;
create policy account_events_admin_all on public.account_events for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');
drop policy if exists account_events_teacher_select on public.account_events;
create policy account_events_teacher_select on public.account_events for select
  using (actor_id = auth.uid() or exists (select 1 from public.profiles p where p.id = account_events.user_id and p.teacher_id = auth.uid()));

drop policy if exists habits_own on public.habits;
create policy habits_own on public.habits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists habit_checks_own on public.habit_checks;
create policy habit_checks_own on public.habit_checks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke execute on function public.manage_user_account(uuid, text) from anon;
revoke execute on function public.apply_teacher_code(text) from anon;
grant execute on function public.apply_teacher_code(text) to authenticated;
grant execute on function public.manage_user_account(uuid, text) to authenticated;

-- Права для вошедших пользователей (сами строки защищены правилами RLS выше)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.schools, public.access_periods, public.account_events, public.habits, public.habit_checks to authenticated;
grant execute on function public.get_my_role(), public.get_my_teacher_id() to authenticated;

-- Трекер по месяцам + вес и ИМТ
alter table public.habits add column if not exists month text;
update public.habits set month = to_char(created_at, 'YYYY-MM') where month is null;
create index if not exists habits_user_month_idx on public.habits(user_id, month);

create table if not exists public.body_profile (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sex text,
  birth_year integer,
  height_cm numeric(5,1),
  activity numeric(4,3),
  updated_at timestamptz not null default now()
);
create table if not exists public.weight_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  weight_kg numeric(5,1) not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.body_profile enable row level security;
alter table public.weight_log enable row level security;
drop policy if exists body_profile_own on public.body_profile;
create policy body_profile_own on public.body_profile for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists weight_log_own on public.weight_log;
create policy weight_log_own on public.weight_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.body_profile, public.weight_log to authenticated;

-- Трекер: настроение, сон, вода, благодарность / колесо баланса / челленджи
create table if not exists public.daily_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  mood smallint check (mood between 1 and 5),
  mood_note text,
  sleep_hours numeric(3,1),
  water_glasses smallint,
  gratitude jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create table if not exists public.balance_wheel (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month text not null,
  scores jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  start_day date not null,
  done jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists challenges_user_idx on public.challenges(user_id);
alter table public.daily_log enable row level security;
alter table public.balance_wheel enable row level security;
alter table public.challenges enable row level security;
drop policy if exists daily_log_own on public.daily_log;
create policy daily_log_own on public.daily_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists balance_wheel_own on public.balance_wheel;
create policy balance_wheel_own on public.balance_wheel for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists challenges_own on public.challenges;
create policy challenges_own on public.challenges for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.daily_log, public.balance_wheel, public.challenges to authenticated;

-- ============================================================
-- Игра «Путь Пробуждения»: онлайн-комнаты, чат, голосовые
-- ============================================================
create table if not exists public.awk_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Путь Пробуждения',
  call_url text,
  state jsonb not null default '{}'::jsonb,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.awk_messages (
  id bigserial primary key,
  room_id uuid not null references public.awk_rooms(id) on delete cascade,
  author text not null,
  body text,
  audio_url text,
  created_at timestamptz not null default now()
);
create index if not exists awk_messages_room_idx on public.awk_messages(room_id, id);
alter table public.awk_rooms enable row level security;
alter table public.awk_messages enable row level security;
create policy awk_rooms_host_all on public.awk_rooms for all to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
grant select, insert, update, delete on public.awk_rooms to authenticated;
-- RPC: awk_get_room, awk_save_state, awk_set_call, awk_messages_list, awk_send (security definer; см. миграцию awk_rpcs)
-- Storage: публичный бакет awk-voice (до 5 МБ, audio/*), загрузка для anon и authenticated

-- Чат v2: фото, удаление своих сообщений (5 минут), архив для администратора и учителей, Лила онлайн
-- awk_rooms.game ('awakening' | 'lila'); awk_messages.image_url, sender_key, deleted
-- awk_can_archive(host): admin — все комнаты; teacher — свои и комнаты своих учеников
-- RPC: awk_messages_list(room, after, key), awk_send(room, author, body, audio, image, key), awk_delete_message(id, key)

-- Трекер: тип строки привычки и вода в литрах
alter table public.habits add column if not exists kind text not null default 'check';
alter table public.habits drop constraint if exists habits_kind_check;
alter table public.habits add constraint habits_kind_check check (kind in ('check','mood','sleep','water'));
alter table public.daily_log add column if not exists water_l numeric(3,1);
-- 1) Трекер и игровые комнаты: записывать можно только при открытом доступе
do $$
declare t text;
begin
  foreach t in array array['habits','habit_checks','daily_log','balance_wheel','body_profile','weight_log','challenges'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_delete', t);
    execute format('create policy %I on public.%I for select using (user_id = auth.uid())', t || '_own_select', t);
    execute format('create policy %I on public.%I for insert with check (user_id = auth.uid() and public.has_grant(''tracker''))', t || '_own_insert', t);
    execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_grant(''tracker''))', t || '_own_update', t);
    execute format('create policy %I on public.%I for delete using (user_id = auth.uid() and public.has_grant(''tracker''))', t || '_own_delete', t);
  end loop;
end $$;

drop policy if exists awk_rooms_host_all on public.awk_rooms;
drop policy if exists awk_rooms_host_select on public.awk_rooms;
drop policy if exists awk_rooms_host_update on public.awk_rooms;
drop policy if exists awk_rooms_host_delete on public.awk_rooms;
drop policy if exists awk_rooms_host_insert on public.awk_rooms;
create policy awk_rooms_host_select on public.awk_rooms for select to authenticated using (host_id = auth.uid());
create policy awk_rooms_host_update on public.awk_rooms for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy awk_rooms_host_delete on public.awk_rooms for delete to authenticated using (host_id = auth.uid());
create policy awk_rooms_host_insert on public.awk_rooms for insert to authenticated
  with check (host_id = auth.uid() and public.has_grant('games.' || game));

-- 2) Учитель может открыть ученику только то, что открыто ему самому, и не дольше своего срока
create or replace function public.grant_item_for(p_uid uuid, p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when s ? p_key then s -> p_key when position('.' in p_key) > 0 then s -> split_part(p_key, '.', 1) end
  from (select granted_scope s from access_periods a
         where a.profile_id = p_uid and lower(a.status) = 'active'
           and (a.payment_status is null or lower(a.payment_status) = 'paid')
           and (a.is_unlimited or a.ends_at is null or a.ends_at >= now())
         order by a.created_at desc limit 1) x;
$$;
revoke all on function public.grant_item_for(uuid, text) from public, anon, authenticated;

create or replace function public.check_teacher_grant()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text; e record; v_mine jsonb; v_lim timestamptz; v_end timestamptz;
begin
  if auth.uid() is null then return new; end if;
  select role::text into v_role from profiles where id = auth.uid();
  if v_role is distinct from 'teacher' then return new; end if;
  for e in select key, value from jsonb_each(coalesce(new.granted_scope, '{}'::jsonb)) loop
    if not public.grant_item_active(e.value) then continue; end if;
    if e.key = 'access' then raise exception 'Учитель не может выдавать доступ к управлению учениками'; end if;
    v_mine := public.grant_item_for(auth.uid(), e.key);
    if not public.grant_item_active(v_mine) then
      raise exception 'Нельзя открыть ученику раздел, который закрыт у вас самих';
    end if;
    if not coalesce((v_mine ->> 'unlimited')::boolean, false) and v_mine ->> 'ends_at' is not null then
      v_lim := (v_mine ->> 'ends_at')::timestamptz;
      v_end := case when coalesce((e.value ->> 'unlimited')::boolean, false) or e.value ->> 'ends_at' is null then 'infinity'::timestamptz else (e.value ->> 'ends_at')::timestamptz end;
      if v_end > v_lim + interval '1 minute' then
        raise exception 'Срок для ученика не может быть дольше вашего: до %', to_char(v_lim, 'DD.MM.YYYY');
      end if;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists access_periods_teacher_check on public.access_periods;
create trigger access_periods_teacher_check before insert or update of granted_scope on public.access_periods
  for each row execute function public.check_teacher_grant();
