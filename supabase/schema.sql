-- Apply once in the SQL editor of the selected Supabase project.
-- This creates new app-specific tables and preserves existing project tables.
BEGIN;
CREATE TABLE public.dc_checklist_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE public.dc_checklist_records (
  id text PRIMARY KEY,
  created_at bigint NOT NULL,
  payload text NOT NULL,
  CONSTRAINT dc_checklist_payload_object CHECK (jsonb_typeof(payload::jsonb) = 'object')
);
CREATE INDEX dc_checklist_records_created_at_idx ON public.dc_checklist_records (created_at,id);
ALTER TABLE public.dc_checklist_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dc_checklist_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dc_checklist_members,public.dc_checklist_records FROM anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
GRANT SELECT ON public.dc_checklist_members TO authenticated;
GRANT SELECT,INSERT ON public.dc_checklist_records TO authenticated;
GRANT SELECT,INSERT ON public.dc_checklist_members,public.dc_checklist_records TO service_role;
CREATE POLICY dc_members_own_membership ON public.dc_checklist_members
  FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY dc_records_members_read ON public.dc_checklist_records
  FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid())));
CREATE POLICY dc_records_members_insert ON public.dc_checklist_records
  FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid())));
COMMIT;

-- Run once for an existing checklist database; rerunning is safe.
-- Existing records, memberships, IDs and payloads are preserved.
BEGIN;
ALTER TABLE public.dc_checklist_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'inspector';
ALTER TABLE public.dc_checklist_members ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';
ALTER TABLE public.dc_checklist_members ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE public.dc_checklist_members ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='dc_checklist_member_role' AND conrelid='public.dc_checklist_members'::regclass) THEN
    ALTER TABLE public.dc_checklist_members ADD CONSTRAINT dc_checklist_member_role CHECK(role IN('inspector','supervisor','admin'));
  END IF;
END $$;
UPDATE public.dc_checklist_members m SET
  email=COALESCE(NULLIF(m.email,''),u.email,''),
  full_name=COALESCE(NULLIF(m.full_name,''),NULLIF(u.raw_user_meta_data->>'full_name',''),u.email,'')
FROM auth.users u WHERE u.id=m.user_id;
ALTER TABLE public.dc_checklist_records ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.dc_checklist_records ALTER COLUMN created_by SET DEFAULT auth.uid();
-- Legacy rows stay unassigned. Their payloads are unchanged and remain visible to supervisors/admins.
CREATE INDEX IF NOT EXISTS dc_checklist_records_author_idx ON public.dc_checklist_records(created_by,created_at,id);
ALTER TABLE public.dc_checklist_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dc_checklist_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dc_checklist_members,public.dc_checklist_records FROM anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
GRANT SELECT ON public.dc_checklist_members TO authenticated;
GRANT SELECT,INSERT ON public.dc_checklist_records TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.dc_checklist_members TO service_role;
GRANT SELECT,INSERT ON public.dc_checklist_records TO service_role;
DROP POLICY IF EXISTS dc_members_own_membership ON public.dc_checklist_members;
CREATE POLICY dc_members_own_membership ON public.dc_checklist_members FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS dc_records_members_read ON public.dc_checklist_records;
CREATE POLICY dc_records_members_read ON public.dc_checklist_records FOR SELECT TO authenticated USING(
  EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active AND
    (m.role IN('supervisor','admin') OR created_by=(SELECT auth.uid()) OR payload::jsonb->>'kind' IN('question','resolve')))
);
DROP POLICY IF EXISTS dc_records_members_insert ON public.dc_checklist_records;
CREATE POLICY dc_records_members_insert ON public.dc_checklist_records FOR INSERT TO authenticated WITH CHECK(
  created_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.dc_checklist_members m
    WHERE m.user_id=(SELECT auth.uid()) AND m.active AND
    ((payload::jsonb->>'kind'='inspection' AND m.role IN('inspector','admin')) OR
     (payload::jsonb->>'kind'='resolve' AND m.role IN('supervisor','admin')) OR
     (payload::jsonb->>'kind'='question' AND m.role='admin')) AND
    (payload::jsonb->>'kind'='question' OR payload::jsonb->>'name'=COALESCE(NULLIF(m.full_name,''),m.email)))
);
-- Service-only, SECURITY INVOKER: application authorization is rechecked under a lock.
CREATE OR REPLACE FUNCTION public.dc_save_member(
  p_actor_id uuid,p_user_id uuid,p_role text,p_full_name text,p_email text,p_active boolean,p_new boolean
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE previous public.dc_checklist_members%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dc_checklist_member_management'));
  IF NOT EXISTS(SELECT 1 FROM public.dc_checklist_members WHERE user_id=p_actor_id AND role='admin' AND active) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501';
  END IF;
  IF p_role NOT IN('inspector','supervisor','admin') OR p_role IS NULL OR p_active IS NULL OR p_new IS NULL
     OR p_full_name IS NULL OR length(trim(p_full_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Invalid member details' USING ERRCODE='22023';
  END IF;
  IF p_user_id=p_actor_id AND (p_role<>'admin' OR NOT p_active) THEN
    RAISE EXCEPTION 'Cannot disable or downgrade your own admin account';
  END IF;
  IF p_new THEN
    IF p_email IS NULL OR length(p_email) NOT BETWEEN 3 AND 254 THEN RAISE EXCEPTION 'Email required'; END IF;
    INSERT INTO public.dc_checklist_members(user_id,role,full_name,email,active)
      VALUES(p_user_id,p_role,trim(p_full_name),lower(trim(p_email)),p_active);
  ELSE
    SELECT * INTO previous FROM public.dc_checklist_members WHERE user_id=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'App member not found'; END IF;
    IF previous.role='admin' AND previous.active AND (p_role<>'admin' OR NOT p_active) AND
      (SELECT count(*) FROM public.dc_checklist_members WHERE role='admin' AND active)<=1 THEN
      RAISE EXCEPTION 'The last active admin must remain enabled';
    END IF;
    UPDATE public.dc_checklist_members SET role=p_role,full_name=trim(p_full_name),active=p_active WHERE user_id=p_user_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.dc_save_member(uuid,uuid,text,text,text,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dc_save_member(uuid,uuid,text,text,text,boolean,boolean) TO service_role;
COMMIT;

-- Run bootstrap-admin.sql next to approve the first admin account.
