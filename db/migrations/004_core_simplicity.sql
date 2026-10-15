begin;
-- Preserve existing priority choices. Only new captures default to no priority.
alter table public.tasks drop constraint tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check check(priority in('None','Low','Medium','High','Critical'));
alter table public.tasks alter column priority set default 'None';
alter table public.projects drop constraint projects_priority_check;
alter table public.projects add constraint projects_priority_check check(priority in('None','Low','Medium','High','Critical'));
-- Inbox is an existing status, while Standard is the ordinary work classification.
alter table public.tasks drop constraint tasks_classification_check;
update public.tasks set classification='Standard' where classification='Inbox';
alter table public.tasks alter column classification set default 'Standard';
alter table public.tasks add constraint tasks_classification_check check(classification in('Standard','Downtime','Ongoing'));
-- Accept writes from the previous deployment while Render replaces the app process.
create function public.normalise_task_classification() returns trigger language plpgsql set search_path='' as $$
begin
 if new.classification='Inbox' then new.classification='Standard';end if;
 return new;
end$$;
create trigger task_00_classification before insert or update of classification on public.tasks for each row execute function public.normalise_task_classification();
revoke all on function public.normalise_task_classification() from public;
commit;
