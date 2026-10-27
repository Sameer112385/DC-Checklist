begin;
create table public.dc_inspection_amendments (
 id uuid primary key,record_id text not null references public.dc_checklist_records(id),
 revision integer not null,reason text not null,actor_id uuid not null,actor_name text not null,
 amended_at timestamptz not null default now(),before_payload jsonb not null,after_payload jsonb not null,
 unique(record_id,revision)
);
create index dc_amendments_record on public.dc_inspection_amendments(record_id,amended_at);
alter table public.dc_inspection_amendments enable row level security;
revoke all on public.dc_inspection_amendments from anon,authenticated;
grant select on public.dc_inspection_amendments to authenticated;
create policy dc_amendments_team_read on public.dc_inspection_amendments for select to authenticated using(public.dc_issue_access());
create or replace function public.dc_amend_inspection(p_record text,p_answers jsonb,p_date text,p_shift text,p_reason text,p_revision integer,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.dc_checklist_members;r public.dc_checklist_records;old jsonb;v jsonb;a record;prev jsonb;answer jsonb;photo text;ticket public.dc_issues;serial bigint;item jsonb;rev integer;event jsonb;labels jsonb:='[]';changed boolean:=false;field text;saved public.dc_inspection_amendments;
begin
 select * into m from public.dc_checklist_members where user_id=auth.uid();
 if not coalesce(m.active and m.role='admin',false) then raise exception 'Admin access required';end if;
 select * into saved from public.dc_inspection_amendments where id=p_request;
 if found then
 if saved.record_id<>p_record or saved.actor_id<>auth.uid() then raise exception 'Request reference already used';end if;
 return jsonb_build_object('record',saved.after_payload,'notificationId',p_request::text);end if;
 if length(trim(coalesce(p_reason,''))) not between 5 and 2000 then raise exception 'Enter a correction reason (5–2000 characters)';end if;
 if coalesce(p_date,'')!~'^\d{4}-\d{2}-\d{2}$' or p_date::date>(now() at time zone 'Asia/Riyadh')::date or coalesce(p_shift,'') not in ('1','2','3') then raise exception 'Choose a valid inspection date and shift';end if;
 perform pg_advisory_xact_lock(7210241);
 select * into r from public.dc_checklist_records where id=p_record for update;
 if not found or r.payload::jsonb->>'kind'<>'inspection' then raise exception 'Inspection not found';end if;
 old:=r.payload::jsonb;rev:=coalesce((old->>'revision')::integer,0);
 if p_revision is distinct from rev then raise exception 'Another admin modified this inspection. Reload before editing';end if;
 if jsonb_typeof(p_answers) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from jsonb_object_keys(old->'answers')) then raise exception 'Keep the submitted checklist items unchanged';end if;
 v:=old;
 for a in select key,value from jsonb_each(old->'answers') loop
 prev:=a.value;answer:=p_answers->a.key;
 if answer is null or jsonb_typeof(answer) is distinct from 'object' or coalesce(answer->>'status','') not in ('Normal','FAULTY','Not applicable') then raise exception 'Select a valid status for every submitted item';end if;
 if prev->>'status'='FAULTY' and answer->>'status'<>'FAULTY' then raise exception 'Recorded faults cannot be cleared by amendment. Use the issue repair and verification workflow';end if;
 if answer->>'status'='FAULTY' and nullif(trim(answer->>'note'),'') is null then raise exception 'Fault details are required';end if;
 if jsonb_typeof(coalesce(answer->'photos','[]'))<>'array' or jsonb_array_length(coalesce(answer->'photos','[]'))>3 then raise exception 'Choose up to 3 photos per item';end if;
 if not(coalesce(answer->'photos','[]') @> coalesce(prev->'photos','[]')) then raise exception 'Original evidence cannot be removed';end if;
 for photo in select jsonb_array_elements_text(coalesce(answer->'photos','[]')) loop
 if not(coalesce(prev->'photos','[]') ? photo) and not exists(select 1 from public.dc_inspection_photos where id::text=photo and user_id=auth.uid() and group_id=old->>'group' and item_id=a.key) then raise exception 'New photos must belong to this admin and checklist item';end if;
 end loop;
 if answer->>'status'='FAULTY' and prev->>'status'<>'FAULTY' and jsonb_array_length(coalesce(answer->'photos','[]'))=0 then raise exception 'New faults require a saved photo';end if;
 -- Only permit answer fields; original ticket references and record identity are immutable.
 answer:=jsonb_build_object('status',answer->>'status','note',coalesce(answer->>'note',''),'temp',coalesce(answer->>'temp',''),'humidity',coalesce(answer->>'humidity',''),'value',coalesce(answer->>'value',''),'photos',coalesce(answer->'photos','[]')) || (prev - array['status','note','temp','humidity','value','photos']);
 select x into item from jsonb_array_elements(coalesce(old->'items','[]')) x where x->>'id'=a.key limit 1;
 if item->>'type'='number' and nullif(answer->>'value','') is not null then perform (answer->>'value')::numeric;end if;
 if item->>'type'='date' and nullif(answer->>'value','') is not null then perform (answer->>'value')::date;end if;
 for field in select unnest(array['temp','humidity']) loop
 if nullif(answer->>field,'') is not null and (answer->>field)!~'^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' then raise exception 'Enter a finite numeric reading';end if;
 end loop;
 if nullif(answer->>'temp','') is not null then perform (answer->>'temp')::numeric;end if;
 if nullif(answer->>'humidity','') is not null and ((answer->>'humidity')::numeric<0 or (answer->>'humidity')::numeric>100) then raise exception 'Humidity must be between 0 and 100';end if;
 if prev->>'status'<>'FAULTY' and answer->>'status'='FAULTY' then
 select * into ticket from public.dc_issues where group_id=old->>'group' and item_id=a.key and status<>'Closed' for update;
 if not found then
 serial:=nextval('public.dc_issue_serial');
 insert into public.dc_issues(number,group_id,item_id,label,location,area,first_record,last_record,reported_at,last_seen,original_note,photos)
 values(to_char(now() at time zone 'Asia/Riyadh','YYMMDD')||'-'||lpad(serial::text,greatest(3,length(serial::text)),'0'),old->>'group',a.key,coalesce((select x->>'label' from jsonb_array_elements(coalesce(old->'items','[]')) x where x->>'id'=a.key limit 1),a.key),coalesce(old->>'location',''),coalesce(old->>'areaName',old->>'area',''),r.id,r.id,now(),now(),answer->>'note',answer->'photos') returning * into ticket;
 end if;
 answer:=answer||jsonb_build_object('issueId',ticket.id,'issueNumber',ticket.number,'issueStatus',ticket.status,'note',concat_ws(' | ',answer->>'note','Issue: '||ticket.number));
 insert into public.dc_issue_events values(gen_random_uuid(),ticket.id,'Reported by inspection amendment',auth.uid(),coalesce(nullif(m.full_name,''),m.email),now(),jsonb_build_object('reason',p_reason,'note',answer->>'note'),r.id);
 end if;
 if exists(select 1 from unnest(array['status','note','temp','humidity','value','photos']) f where case when f='photos' then coalesce(prev->f,'[]') is distinct from coalesce(answer->f,'[]') else coalesce(prev->>f,'') is distinct from coalesce(answer->>f,'') end) then changed:=true;labels:=labels||jsonb_build_array(coalesce((select x->>'label' from jsonb_array_elements(coalesce(old->'items','[]')) x where x->>'id'=a.key limit 1),a.key));end if;
 v:=jsonb_set(v,array['answers',a.key],answer);
 end loop;
 v:=v||jsonb_build_object('date',p_date,'shift',p_shift);
 if not changed and p_date=old->>'date' and p_shift=old->>'shift' then raise exception 'No changes to save';end if;
 v:=v||jsonb_build_object('revision',rev+1,'amendedAt',now(),'amendedBy',coalesce(nullif(m.full_name,''),m.email),'amendmentReason',trim(p_reason));
 insert into public.dc_inspection_amendments values(p_request,r.id,rev+1,trim(p_reason),auth.uid(),coalesce(nullif(m.full_name,''),m.email),now(),old,v);
 update public.dc_checklist_records set payload=v::text where id=r.id;
 event:=jsonb_build_object('id',p_request::text,'kind','inspection_amendment','inspectionId',r.id,'revision',rev+1,'name',coalesce(nullif(m.full_name,''),m.email),'date',to_char(now() at time zone 'Asia/Riyadh','YYYY-MM-DD'),'createdAt',floor(extract(epoch from now())*1000),'area',coalesce(old->>'area',old->>'group'),'details',jsonb_build_object('reason',trim(p_reason),'revision',rev+1,'originalInspector',old->>'name','inspectionDate',p_date,'shift',p_shift,'changedItems',labels,'photos',coalesce((select jsonb_agg(distinct p) from jsonb_each(v->'answers') x cross join lateral jsonb_array_elements(coalesce(x.value->'photos','[]')) p),'[]')));
 insert into public.dc_checklist_records(id,created_at,payload,created_by) values(p_request::text,(event->>'createdAt')::bigint,event::text,auth.uid());
 return jsonb_build_object('record',v,'notificationId',p_request::text);
end $$;
revoke all on function public.dc_amend_inspection(text,jsonb,text,text,text,integer,uuid) from public,anon;
grant execute on function public.dc_amend_inspection(text,jsonb,text,text,text,integer,uuid) to authenticated;
commit;
