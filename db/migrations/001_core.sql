begin;
do $$begin if not exists(select from pg_roles where rolname='hub_app') then create role hub_app nologin;end if;execute format('grant hub_app to %I',current_user);end$$;
grant usage on schema public to hub_app;

create table public.authorised_users(user_id uuid primary key references public."user"(id) on delete cascade);
alter table public.authorised_users enable row level security;
create function public.hub_uid() returns uuid language sql stable set search_path='' as $$select nullif(current_setting('hub.user_id',true),'')::uuid$$;
create policy own_authorisation on public.authorised_users for select to hub_app using(user_id=public.hub_uid());
create function public.is_authorised() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.authorised_users where user_id=public.hub_uid())$$;
create table public.profiles(user_id uuid primary key references public."user"(id) on delete cascade,display_name text not null default '',timezone text not null default 'Australia/Adelaide',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.projects(id uuid primary key default gen_random_uuid(),user_id uuid not null references public."user"(id) on delete cascade,name text not null check(length(trim(name)) between 1 and 255),description text not null default '',notes text not null default '',category text not null default '',status text not null default 'Active' check(status in('Planned','Active','On Hold','Completed','Archived')),priority text not null default 'Medium' check(priority in('Low','Medium','High','Critical')),start_date date,target_date date,actual_date date,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id));
create table public.tasks(id uuid primary key default gen_random_uuid(),user_id uuid not null references public."user"(id) on delete cascade,title text not null check(length(trim(title)) between 1 and 255),description text not null default '',notes text not null default '',project_id uuid,parent_id uuid,status text not null default 'Inbox' check(status in('Inbox','To Do','In Progress','Waiting','Blocked','Completed')),priority text not null default 'Medium' check(priority in('Low','Medium','High','Critical')),start_date date,due_date date,completed_at timestamptz,person text not null default '',tags text[] not null default '{}',archived boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id),foreign key(project_id,user_id) references public.projects(id,user_id) on delete restrict,foreign key(parent_id,user_id) references public.tasks(id,user_id) on delete restrict,check(parent_id is null or parent_id<>id));
create table public.activity(id uuid primary key default gen_random_uuid(),user_id uuid not null references public."user"(id) on delete cascade,entity_type text not null,entity_id uuid not null,title text not null,action text not null,changes jsonb not null default '{}',created_at timestamptz not null default now());
create index projects_owner on public.projects(user_id,status);
create index tasks_owner on public.tasks(user_id,status,due_date);
create index tasks_project on public.tasks(project_id);
create index tasks_parent on public.tasks(parent_id);
create index activity_owner on public.activity(user_id,created_at desc);
-- Serialize parent graph changes per owner to prevent concurrent cycle creation.
create function public.guard_task() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 if new.parent_id is not null and exists(with recursive ancestors as(select id,parent_id from public.tasks where id=new.parent_id and user_id=new.user_id union select t.id,t.parent_id from public.tasks t join ancestors a on t.id=a.parent_id where t.user_id=new.user_id) select 1 from ancestors where id=new.id) then raise exception 'Subtasks cannot form a loop';end if;
 if new.status='Completed' then new.completed_at=coalesce(new.completed_at,now());else new.completed_at=null;end if;
 return new;
end$$;
create trigger task_guard before insert or update on public.tasks for each row execute function public.guard_task();
create function public.track_change() returns trigger language plpgsql security definer set search_path='' as $$
declare old_row jsonb;new_row jsonb;diff jsonb;
begin
 if tg_op='UPDATE' then new.updated_at=now();end if;
 if tg_op='DELETE' then old_row=to_jsonb(old);new_row='{}';else new_row=to_jsonb(new);old_row=case when tg_op='UPDATE' then to_jsonb(old) else '{}' end;end if;
 select coalesce(jsonb_object_agg(key,jsonb_build_object('from',old_row->key,'to',value)),'{}') into diff from jsonb_each(new_row) where key in('status','priority','due_date','project_id','parent_id','name','title','target_date') and old_row->key is distinct from value;
 insert into public.activity(user_id,entity_type,entity_id,title,action,changes) values(coalesce(new_row->>'user_id',old_row->>'user_id')::uuid,tg_table_name,coalesce(new_row->>'id',old_row->>'id')::uuid,coalesce(new_row->>'title',new_row->>'name',old_row->>'title',old_row->>'name'),lower(tg_op),diff);
 if tg_op='DELETE' then return old;else return new;end if;
end$$;
create trigger task_activity before insert or update or delete on public.tasks for each row execute function public.track_change();
create trigger project_activity before insert or update or delete on public.projects for each row execute function public.track_change();
do $$declare t text;begin foreach t in array array['profiles','projects','tasks'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy own_records on public.%I for all to hub_app using(user_id=public.hub_uid() and public.is_authorised()) with check(user_id=public.hub_uid() and public.is_authorised())',t);end loop;end$$;
alter table public.activity enable row level security;
create policy own_activity on public.activity for select to hub_app using(user_id=public.hub_uid() and public.is_authorised());
revoke all on public.authorised_users,public.activity from public,hub_app;
grant select on public.authorised_users,public.activity to hub_app;
revoke all on public.projects,public.tasks,public.profiles from public;
grant select,insert,update,delete on public.projects,public.tasks,public.profiles to hub_app;
revoke all on function public.track_change(),public.guard_task() from public;
commit;
