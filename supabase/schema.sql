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
-- Add an existing Supabase Auth user after creating the tables:
-- INSERT INTO public.dc_checklist_members(user_id)
-- SELECT id FROM auth.users WHERE email='your-email@example.com'
-- ON CONFLICT DO NOTHING;
-- Membership is managed only by a trusted project administrator.
