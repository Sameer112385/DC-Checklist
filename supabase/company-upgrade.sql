BEGIN;
CREATE TABLE IF NOT EXISTS public.dc_company_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),name text NOT NULL DEFAULT 'DETASAD' CHECK(length(trim(name)) BETWEEN 1 AND 120),logo_data text CHECK(logo_data IS NULL OR (length(logo_data)<=2796300 AND logo_data ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$')));
CREATE TABLE IF NOT EXISTS public.dc_checklist_areas(id text PRIMARY KEY,site text NOT NULL CHECK(length(trim(site)) BETWEEN 1 AND 120),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS dc_area_names_unique ON public.dc_checklist_areas(lower(trim(site)),lower(trim(name)));
INSERT INTO public.dc_company_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE public.dc_company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dc_checklist_areas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dc_company_settings,public.dc_checklist_areas FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.dc_company_settings TO authenticated;
GRANT SELECT,INSERT ON public.dc_checklist_areas TO authenticated;
GRANT ALL ON public.dc_company_settings,public.dc_checklist_areas TO service_role;

DROP POLICY IF EXISTS dc_company_read ON public.dc_company_settings;
CREATE POLICY dc_company_read ON public.dc_company_settings FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active));
DROP POLICY IF EXISTS dc_company_insert ON public.dc_company_settings;
CREATE POLICY dc_company_insert ON public.dc_company_settings FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active AND m.role='admin'));

DROP POLICY IF EXISTS dc_company_read ON public.dc_checklist_areas;
CREATE POLICY dc_company_read ON public.dc_checklist_areas FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active));
DROP POLICY IF EXISTS dc_company_insert ON public.dc_checklist_areas;
CREATE POLICY dc_company_insert ON public.dc_checklist_areas FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active AND m.role='admin'));

DROP POLICY IF EXISTS dc_company_update ON public.dc_company_settings;
CREATE POLICY dc_company_update ON public.dc_company_settings FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active AND m.role='admin')) WITH CHECK(EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active AND m.role='admin'));
COMMIT;
