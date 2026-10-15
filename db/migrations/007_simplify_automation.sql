begin;
alter table public.tasks add column suggested_start date,add column suggested_end date,add column planned_for date,add column depends_on_id uuid,
 add column recurrence_rule jsonb,add column recurrence_series_id uuid,add column recurrence_date date,
 add column reminder_enabled boolean not null default false,add column reminder_on date,
 add foreign key(depends_on_id,user_id) references public.tasks(id,user_id) on delete restrict,add check(depends_on_id is null or depends_on_id<>id),add check(suggested_end is null or suggested_start is null or suggested_end>=suggested_start);
create table public.recurring_series(id uuid primary key default gen_random_uuid(),user_id uuid not null references public."user"(id) on delete cascade,
 template jsonb not null,rule jsonb not null,next_date date,paused boolean not null default false,stopped boolean not null default false,skipped_count integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id));
alter table public.tasks add foreign key(recurrence_series_id,user_id) references public.recurring_series(id,user_id) on delete restrict;
create unique index task_recurrence_once on public.tasks(recurrence_series_id,recurrence_date) where recurrence_series_id is not null;
-- Tombstones retain occurrence identity even if a task is subsequently deleted.
create table public.recurrence_occurrences(user_id uuid not null,series_id uuid not null,occurrence_date date not null,task_id uuid not null,
 primary key(series_id,occurrence_date),foreign key(series_id,user_id) references public.recurring_series(id,user_id) on delete cascade);
create table public.notification_settings(user_id uuid primary key references public."user"(id) on delete cascade,webhook_cipher text,
 enabled boolean not null default false,daily boolean not null default true,weekly boolean not null default false,important boolean not null default false,
 send_time text not null default '09:00' check(send_time~'^([01][0-9]|2[0-3]):[0-5][0-9]$'),privacy boolean not null default true,tenant_confirmed boolean not null default false,updated_at timestamptz not null default now());
create table public.notification_deliveries(id uuid primary key default gen_random_uuid(),user_id uuid not null references public."user"(id) on delete cascade,
 notification_key text not null,kind text not null,payload jsonb not null,status text not null default 'pending' check(status in('pending','sending','delivered','failed','unknown','cancelled')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),claimed_at timestamptz,delivered_at timestamptz,error_code text,created_at timestamptz not null default now(),unique(user_id,notification_key));
create index notification_queue on public.notification_deliveries(user_id,status,next_attempt_at);
create table public.automation_runs(user_id uuid primary key references public."user"(id) on delete cascade,last_run_at timestamptz not null default now());
do $$declare t text;begin foreach t in array array['recurring_series','recurrence_occurrences','notification_settings','notification_deliveries','automation_runs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_records on public.%I for all to hub_app using(user_id=public.hub_uid() and public.is_authorised()) with check(user_id=public.hub_uid() and public.is_authorised())',t);
 execute format('revoke all on public.%I from public',t);execute format('grant select,insert,update,delete on public.%I to hub_app',t);
end loop;end$$;
-- Add TP without replacing custom aliases or renaming existing teams.
update public.teams set aliases=array(select distinct a from unnest(aliases||array['TP']) a) where name_key='technology planning';
create or replace function public.seed_people_teams() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.teams(user_id,name,aliases) values(new.user_id,'Technology Planning',array['TP','Planning']),(new.user_id,'Technology Systems',array['Systems']),(new.user_id,'GM',array[]::text[]),(new.user_id,'Other People',array[]::text[]) on conflict do nothing;return new;
end$$;
commit;
