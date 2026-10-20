BEGIN;
-- Only approved public-facing branding is exposed before sign-in.
CREATE OR REPLACE FUNCTION public.dc_login_branding() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('name',name,'logo_data',logo_data)
 FROM public.dc_company_settings WHERE id=true;
$$;
REVOKE ALL ON FUNCTION public.dc_login_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dc_login_branding() TO anon,authenticated;
COMMIT;
