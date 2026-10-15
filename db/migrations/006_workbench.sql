begin;
alter table public.tasks
 add column progress_entries jsonb not null default '[]'::jsonb check(jsonb_typeof(progress_entries)='array'),
 add column reference_links jsonb not null default '[]'::jsonb check(jsonb_typeof(reference_links)='array'),
 add column subtask_position integer not null default 0 check(subtask_position>=0),
 add column awaiting_decision boolean not null default false,
 add column content_type text not null default 'Task' check(content_type in('Task','Idea','Note'));
create index tasks_assignee on public.tasks(user_id,assigned_person_id);
create index tasks_subtask_order on public.tasks(user_id,parent_id,subtask_position);
create table public.step_imports(
 user_id uuid not null,request_id uuid not null,parent_id uuid not null,titles jsonb not null,task_ids uuid[] not null,
 created_at timestamptz not null default now(),primary key(user_id,request_id),
 foreign key(parent_id,user_id) references public.tasks(id,user_id) on delete cascade
);
alter table public.step_imports enable row level security;
create policy own_records on public.step_imports for all to hub_app using(user_id=public.hub_uid() and public.is_authorised()) with check(user_id=public.hub_uid() and public.is_authorised());
revoke all on public.step_imports from public;
grant select,insert,update,delete on public.step_imports to hub_app;
commit;
