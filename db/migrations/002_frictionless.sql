begin;
alter table public.tasks
  add column classification text not null default 'Inbox' check(classification in('Inbox','Downtime','Ongoing')),
  add column assigned_to text not null default '',
  add column date_assigned date,
  add column assignment_notes text not null default '',
  add column follow_up_date date,
  add column effort_minutes integer check(effort_minutes in(15,30,60,120,240,960)),
  add column snoozed_until date,
  add column next_action text not null default '',
  add column is_milestone boolean not null default false,
  add column date_preferences jsonb not null default '{}';
alter table public.projects
  add column next_action text not null default '',
  add column date_preferences jsonb not null default '{}';
create index tasks_classification on public.tasks(user_id,classification);
create index tasks_delegation on public.tasks(user_id,assigned_to,follow_up_date);
create table public.capture_batches(
  user_id uuid not null references public."user"(id) on delete cascade,
  request_id uuid not null,
  lines jsonb not null,
  records jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table public.capture_batches enable row level security;
create policy own_capture on public.capture_batches for all to hub_app
  using(user_id=public.hub_uid() and public.is_authorised())
  with check(user_id=public.hub_uid() and public.is_authorised());
revoke all on public.capture_batches from public;
grant select,insert on public.capture_batches to hub_app;
-- Include delegation and progress changes in the existing audit trail.
create or replace function public.track_change() returns trigger language plpgsql security definer set search_path='' as $$
declare old_row jsonb;new_row jsonb;diff jsonb;
begin
 if tg_op='UPDATE' then new.updated_at=now();end if;
 if tg_op='DELETE' then old_row=to_jsonb(old);new_row='{}';else new_row=to_jsonb(new);old_row=case when tg_op='UPDATE' then to_jsonb(old) else '{}' end;end if;
 select coalesce(jsonb_object_agg(key,jsonb_build_object('from',old_row->key,'to',value)),'{}') into diff from jsonb_each(new_row) where key in('status','priority','due_date','project_id','parent_id','name','title','target_date','classification','assigned_to','date_assigned','follow_up_date','assignment_notes','notes','next_action','effort_minutes','snoozed_until','is_milestone','date_preferences') and old_row->key is distinct from value;
 insert into public.activity(user_id,entity_type,entity_id,title,action,changes) values(coalesce(new_row->>'user_id',old_row->>'user_id')::uuid,tg_table_name,coalesce(new_row->>'id',old_row->>'id')::uuid,coalesce(new_row->>'title',new_row->>'name',old_row->>'title',old_row->>'name'),lower(tg_op),diff);
 if tg_op='DELETE' then return old;else return new;end if;
end$$;
commit;
