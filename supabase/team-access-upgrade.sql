BEGIN;
ALTER TABLE public.dc_checklist_members ADD COLUMN IF NOT EXISTS password_change_required boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.dc_mark_password_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
  UPDATE public.dc_checklist_members SET password_change_required=true WHERE user_id=NEW.id AND role<>'admin';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.dc_mark_password_change() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS dc_password_changed ON auth.users;
CREATE TRIGGER dc_password_changed AFTER UPDATE OF encrypted_password ON auth.users FOR EACH ROW EXECUTE FUNCTION public.dc_mark_password_change();
DROP POLICY IF EXISTS dc_records_members_read ON public.dc_checklist_records;
CREATE POLICY dc_records_members_read ON public.dc_checklist_records FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active AND (m.role='admin' OR NOT m.password_change_required))
);
DROP POLICY IF EXISTS dc_records_members_insert ON public.dc_checklist_records;
CREATE POLICY dc_records_members_insert ON public.dc_checklist_records FOR INSERT TO authenticated WITH CHECK(
 created_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active AND (m.role='admin' OR NOT m.password_change_required) AND
 ((payload::jsonb->>'kind'='inspection' AND m.role IN('inspector','admin')) OR (payload::jsonb->>'kind'='resolve' AND m.role IN('inspector','supervisor','admin')) OR (payload::jsonb->>'kind'='question' AND m.role='admin')) AND
 (payload::jsonb->>'kind'='question' OR payload::jsonb->>'name'=COALESCE(NULLIF(m.full_name,''),m.email)))
);
DROP POLICY IF EXISTS dc_photos_read ON public.dc_inspection_photos;
CREATE POLICY dc_photos_read ON public.dc_inspection_photos FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active AND (m.role='admin' OR NOT m.password_change_required) AND (dc_inspection_photos.user_id=m.user_id OR EXISTS(SELECT 1 FROM public.dc_checklist_records r WHERE r.payload::jsonb->>'kind'='inspection' AND r.payload::jsonb @> jsonb_build_object('answers',jsonb_build_object(dc_inspection_photos.item_id,jsonb_build_object('photos',jsonb_build_array(dc_inspection_photos.id::text)))))))
);
COMMIT;
