begin;
create or replace function public.dc_valid_shift_schedule(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare i integer;s jsonb;
begin
 if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value)<>3 then return false;end if;
 for i in 0..2 loop
 s:=value->i;
 if s->>'id' is distinct from (i+1)::text or coalesce(s->>'start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(s->>'end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or s->>'start'=s->>'end' then return false;end if;
 end loop;return true;
end $$;
revoke all on function public.dc_valid_shift_schedule(jsonb) from public,anon;
grant execute on function public.dc_valid_shift_schedule(jsonb) to authenticated,service_role;
alter table public.dc_company_settings add column if not exists shift_schedule jsonb not null default '[{"id":"1","start":"08:00","end":"17:00"},{"id":"2","start":"14:00","end":"23:00"},{"id":"3","start":"23:00","end":"08:00"}]';
do $$begin if not exists(select 1 from pg_constraint where conname='dc_shift_schedule_valid' and conrelid='public.dc_company_settings'::regclass) then alter table public.dc_company_settings add constraint dc_shift_schedule_valid check(public.dc_valid_shift_schedule(shift_schedule));end if;end $$;
grant select(shift_schedule),update(shift_schedule) on public.dc_company_settings to authenticated;
commit;
