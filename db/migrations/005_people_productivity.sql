begin;
create table public.teams(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public."user"(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 255),description text not null default '',aliases text[] not null default '{}',archived boolean not null default false,
 name_key text generated always as(lower(regexp_replace(btrim(name),'\s+',' ','g'))) stored,
 unique(id,user_id),unique(user_id,name_key)
);
create table public.people(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public."user"(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 255),notes text not null default '',archived boolean not null default false,
 name_key text generated always as(lower(regexp_replace(btrim(name),'\s+',' ','g'))) stored,
 unique(id,user_id),unique(user_id,name_key)
);
create table public.person_teams(
 user_id uuid not null,person_id uuid not null,team_id uuid not null,primary key(person_id,team_id),
 foreign key(person_id,user_id) references public.people(id,user_id) on delete cascade,
 foreign key(team_id,user_id) references public.teams(id,user_id) on delete restrict
);
alter table public.tasks add column team_id uuid,add column person_id uuid,add column assigned_person_id uuid,
 add column task_type text not null default 'To Do' check(task_type in('To Do','Discuss','Follow Up','Delegated')),
 add column focus_dismissed_until date,
 add foreign key(team_id,user_id) references public.teams(id,user_id) on delete restrict,
 add foreign key(person_id,user_id) references public.people(id,user_id) on delete restrict,
 add foreign key(assigned_person_id,user_id) references public.people(id,user_id) on delete restrict;
alter table public.profiles add column last_opened_at timestamptz;
create index tasks_team on public.tasks(user_id,team_id,task_type);
create index tasks_person on public.tasks(user_id,person_id);
create index person_teams_team on public.person_teams(user_id,team_id);
do $$declare t text;begin foreach t in array array['teams','people','person_teams'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_records on public.%I for all to hub_app using(user_id=public.hub_uid() and public.is_authorised()) with check(user_id=public.hub_uid() and public.is_authorised())',t);
 execute format('revoke all on public.%I from public',t);
 execute format('grant select,insert,update,delete on public.%I to hub_app',t);
end loop;end$$;
insert into public.people(user_id,name) select distinct on(user_id,lower(regexp_replace(btrim(assigned_to),'\s+',' ','g'))) user_id,regexp_replace(btrim(assigned_to),'\s+',' ','g') from public.tasks where btrim(assigned_to)<>'' order by user_id,lower(regexp_replace(btrim(assigned_to),'\s+',' ','g')),created_at;
update public.tasks t set person_id=p.id,assigned_person_id=p.id,task_type='Delegated' from public.people p where t.user_id=p.user_id and lower(regexp_replace(btrim(t.assigned_to),'\s+',' ','g'))=p.name_key;
update public.tasks set task_type='Follow Up' where status='Waiting' and task_type='To Do';
insert into public.teams(user_id,name,aliases) select a.user_id,v.name,v.aliases from public.authorised_users a cross join (values('Technology Planning',array['Planning']),('Technology Systems',array['Systems']),('GM',array[]::text[]),('Other People',array[]::text[])) v(name,aliases);
create function public.seed_people_teams() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.teams(user_id,name,aliases) values(new.user_id,'Technology Planning',array['Planning']),(new.user_id,'Technology Systems',array['Systems']),(new.user_id,'GM',array[]::text[]),(new.user_id,'Other People',array[]::text[]) on conflict do nothing;return new;
end$$;
create trigger seed_owner_people_teams after insert on public.authorised_users for each row execute function public.seed_people_teams();
revoke all on function public.seed_people_teams() from public;
create or replace function public.track_change() returns trigger language plpgsql security definer set search_path='' as $$
declare old_row jsonb;new_row jsonb;diff jsonb;
begin
 if tg_op='UPDATE' then new.updated_at=now();end if;
 if tg_op='DELETE' then old_row=to_jsonb(old);new_row='{}';else new_row=to_jsonb(new);old_row=case when tg_op='UPDATE' then to_jsonb(old) else '{}' end;end if;
 select coalesce(jsonb_object_agg(key,jsonb_build_object('from',old_row->key,'to',value)),'{}') into diff from jsonb_each(new_row) where key in('status','priority','due_date','project_id','parent_id','name','title','target_date','classification','assigned_to','date_assigned','follow_up_date','assignment_notes','notes','next_action','effort_minutes','snoozed_until','is_milestone','date_preferences','bucket_id','tags','team_id','person_id','task_type','assigned_person_id','focus_dismissed_until') and old_row->key is distinct from value;
 insert into public.activity(user_id,entity_type,entity_id,title,action,changes) values(coalesce(new_row->>'user_id',old_row->>'user_id')::uuid,tg_table_name,coalesce(new_row->>'id',old_row->>'id')::uuid,coalesce(new_row->>'title',new_row->>'name',old_row->>'title',old_row->>'name'),lower(tg_op),diff);
 if tg_op='DELETE' then return old;else return new;end if;
end$$;
commit;
