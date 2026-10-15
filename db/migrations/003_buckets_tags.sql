begin;
create table public.buckets(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public."user"(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 100),
 description text not null default '', aliases text[] not null default '{}',
 position integer not null default 0, archived boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 name_key text generated always as (lower(regexp_replace(btrim(name),'\s+',' ','g'))) stored,
 unique(id,user_id),unique(user_id,name_key)
);
create table public.tags(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public."user"(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 60),
 name_key text generated always as (lower(regexp_replace(btrim(name),'\s+',' ','g'))) stored,
 unique(id,user_id),unique(user_id,name_key)
);
alter table public.tasks add column bucket_id uuid,
 add foreign key(bucket_id,user_id) references public.buckets(id,user_id) on delete restrict;
alter table public.projects add column tags text[] not null default '{}';
alter table public.capture_batches add column defaults jsonb not null default '{}';
create index tasks_bucket on public.tasks(user_id,bucket_id);
create table public.task_tags(
 user_id uuid not null,task_id uuid not null,tag_id uuid not null,
 primary key(task_id,tag_id),
 foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade,
 foreign key(tag_id,user_id) references public.tags(id,user_id) on delete restrict
);
create table public.project_tags(
 user_id uuid not null,project_id uuid not null,tag_id uuid not null,
 primary key(project_id,tag_id),
 foreign key(project_id,user_id) references public.projects(id,user_id) on delete cascade,
 foreign key(tag_id,user_id) references public.tags(id,user_id) on delete restrict
);
create index task_tags_tag on public.task_tags(user_id,tag_id);
create index project_tags_tag on public.project_tags(user_id,tag_id);
do $$declare t text;begin foreach t in array array['buckets','tags','task_tags','project_tags'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_records on public.%I for all to hub_app using(user_id=public.hub_uid() and public.is_authorised()) with check(user_id=public.hub_uid() and public.is_authorised())',t);
 execute format('revoke all on public.%I from public',t);
 execute format('grant select,insert,update,delete on public.%I to hub_app',t);
end loop;end$$;
-- Keep the existing tags arrays compatible while maintaining relational associations.
create function public.normalise_record_tags() returns trigger language plpgsql set search_path='' as $$
declare input_name text; canonical text; names text[]='{}';
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 foreach input_name in array new.tags loop
  input_name=regexp_replace(btrim(input_name),'\s+',' ','g');
  if input_name='' then continue;end if;
  insert into public.tags(user_id,name) values(new.user_id,input_name)
   on conflict(user_id,name_key) do update set name=tags.name returning name into canonical;
  if not canonical=any(names) then names=array_append(names,canonical);end if;
 end loop;
 new.tags=names;return new;
end$$;
create function public.sync_record_tags() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='tasks' then
  delete from public.task_tags where task_id=new.id and user_id=new.user_id;
  insert into public.task_tags(user_id,task_id,tag_id) select new.user_id,new.id,id from public.tags where user_id=new.user_id and name=any(new.tags);
 else
  delete from public.project_tags where project_id=new.id and user_id=new.user_id;
  insert into public.project_tags(user_id,project_id,tag_id) select new.user_id,new.id,id from public.tags where user_id=new.user_id and name=any(new.tags);
 end if;return new;
end$$;
create trigger task_tags_normalise before insert or update of tags on public.tasks for each row execute function public.normalise_record_tags();
create trigger project_tags_normalise before insert or update of tags on public.projects for each row execute function public.normalise_record_tags();
create trigger task_tags_sync after insert or update of tags on public.tasks for each row execute function public.sync_record_tags();
create trigger project_tags_sync after insert or update of tags on public.projects for each row execute function public.sync_record_tags();
-- Backfill every existing tag; only whitespace/case duplicates are consolidated.
update public.tasks set tags=tags;
create function public.seed_organisation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.buckets(user_id,name,aliases,position) values
 (new.user_id,'Vectorworks (VWX)',array['VWX','Vectorworks'],0),
 (new.user_id,'Momentus',array[]::text[],1),
 (new.user_id,'MyAVM / SharePoint',array['MyAVM','SharePoint'],2),
 (new.user_id,'Technology Systems',array[]::text[],3),
 (new.user_id,'Other Ideas',array[]::text[],4) on conflict do nothing;
 insert into public.tags(user_id,name) select new.user_id,n from unnest(array['Automation','Research','Improvement','Bug','Documentation','Quick Win','Delegatable']) n on conflict do nothing;
 return new;
end$$;
create trigger seed_owner_organisation after insert on public.authorised_users for each row execute function public.seed_organisation();
insert into public.buckets(user_id,name,aliases,position)
 select a.user_id,v.name,v.aliases,v.position from public.authorised_users a cross join (values
 ('Vectorworks (VWX)',array['VWX','Vectorworks'],0),('Momentus',array[]::text[],1),
 ('MyAVM / SharePoint',array['MyAVM','SharePoint'],2),('Technology Systems',array[]::text[],3),('Other Ideas',array[]::text[],4)) v(name,aliases,position) on conflict do nothing;
insert into public.tags(user_id,name) select a.user_id,n from public.authorised_users a cross join unnest(array['Automation','Research','Improvement','Bug','Documentation','Quick Win','Delegatable']) n on conflict do nothing;
revoke all on function public.seed_organisation(),public.normalise_record_tags(),public.sync_record_tags() from public;
create or replace function public.track_change() returns trigger language plpgsql security definer set search_path='' as $$
declare old_row jsonb;new_row jsonb;diff jsonb;
begin
 if tg_op='UPDATE' then new.updated_at=now();end if;
 if tg_op='DELETE' then old_row=to_jsonb(old);new_row='{}';else new_row=to_jsonb(new);old_row=case when tg_op='UPDATE' then to_jsonb(old) else '{}' end;end if;
 select coalesce(jsonb_object_agg(key,jsonb_build_object('from',old_row->key,'to',value)),'{}') into diff from jsonb_each(new_row) where key in('status','priority','due_date','project_id','parent_id','name','title','target_date','classification','assigned_to','date_assigned','follow_up_date','assignment_notes','notes','next_action','effort_minutes','snoozed_until','is_milestone','date_preferences','bucket_id','tags') and old_row->key is distinct from value;
 insert into public.activity(user_id,entity_type,entity_id,title,action,changes) values(coalesce(new_row->>'user_id',old_row->>'user_id')::uuid,tg_table_name,coalesce(new_row->>'id',old_row->>'id')::uuid,coalesce(new_row->>'title',new_row->>'name',old_row->>'title',old_row->>'name'),lower(tg_op),diff);
 if tg_op='DELETE' then return old;else return new;end if;
end$$;
commit;
