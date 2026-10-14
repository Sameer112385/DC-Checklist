BEGIN;
CREATE TABLE IF NOT EXISTS public.dc_microsoft_settings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES auth.users(id), settings jsonb NOT NULL, webhook_url text NOT NULL
);
ALTER TABLE public.dc_microsoft_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dc_microsoft_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.dc_microsoft_settings TO service_role;
CREATE TABLE IF NOT EXISTS public.dc_inspection_photos(
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
 group_id text NOT NULL,item_id text NOT NULL, config_id uuid NOT NULL REFERENCES public.dc_microsoft_settings(id),
 file_path text NOT NULL,web_url text NOT NULL, mime_type text NOT NULL CHECK(mime_type IN('image/jpeg','image/png','image/webp')),
 bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 5242880), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dc_photos_owner_idx ON public.dc_inspection_photos(user_id,created_at);
ALTER TABLE public.dc_inspection_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dc_inspection_photos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.dc_inspection_photos TO authenticated;
GRANT SELECT,INSERT ON public.dc_inspection_photos TO service_role;
DROP POLICY IF EXISTS dc_photos_read ON public.dc_inspection_photos;
CREATE POLICY dc_photos_read ON public.dc_inspection_photos FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.dc_checklist_members m WHERE m.user_id=(SELECT auth.uid()) AND m.active
 AND (dc_inspection_photos.user_id=m.user_id OR m.role IN('admin','supervisor'))));
CREATE OR REPLACE FUNCTION public.dc_require_fault_photos() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE answer record;photo_id text;found_photo boolean;payload jsonb;
BEGIN
 payload:=NEW.payload::jsonb;
 IF payload->>'kind'<>'inspection' OR NEW.created_by IS NULL THEN RETURN NEW;END IF;
 FOR answer IN SELECT key,value FROM jsonb_each(payload->'answers') LOOP
  IF answer.value->>'status'='FAULTY' AND (jsonb_typeof(answer.value->'photos') IS DISTINCT FROM 'array' OR jsonb_array_length(answer.value->'photos')=0) THEN
   RAISE EXCEPTION 'Every faulty item requires a saved photo' USING ERRCODE='23514';
  END IF;
  IF answer.value ? 'photos' THEN
   IF jsonb_typeof(answer.value->'photos')<>'array' OR jsonb_array_length(answer.value->'photos')>3 THEN RAISE EXCEPTION 'Invalid photo list' USING ERRCODE='23514';END IF;
   FOR photo_id IN SELECT jsonb_array_elements_text(answer.value->'photos') LOOP
    SELECT EXISTS(SELECT 1 FROM public.dc_inspection_photos p WHERE p.id::text=photo_id AND p.user_id=NEW.created_by AND p.item_id=answer.key AND p.group_id=payload->>'group') INTO found_photo;
    IF NOT found_photo THEN RAISE EXCEPTION 'Photo does not belong to this inspector and check' USING ERRCODE='23514';END IF;
   END LOOP;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.dc_require_fault_photos() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS dc_fault_photos_required ON public.dc_checklist_records;
CREATE TRIGGER dc_fault_photos_required BEFORE INSERT ON public.dc_checklist_records FOR EACH ROW EXECUTE FUNCTION public.dc_require_fault_photos();
CREATE TABLE IF NOT EXISTS public.dc_teams_notifications(
 record_id text PRIMARY KEY REFERENCES public.dc_checklist_records(id), config_id uuid NOT NULL REFERENCES public.dc_microsoft_settings(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dc_teams_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dc_teams_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.dc_teams_notifications TO service_role;
COMMIT;
