-- Run after roles-upgrade.sql. This approves your existing login as the first admin.
-- Change the email if you intend to use a different existing Supabase Auth account.
DO $$
DECLARE account_id uuid;
BEGIN
  SELECT id INTO account_id FROM auth.users WHERE lower(email)='sameer.shaikh@detasad.com';
  IF account_id IS NULL THEN RAISE EXCEPTION 'Create the intended admin account in Supabase Auth first'; END IF;
  INSERT INTO public.dc_checklist_members(user_id,email,full_name,role,active)
    SELECT id,email,COALESCE(NULLIF(raw_user_meta_data->>'full_name',''),email),'admin',true FROM auth.users WHERE id=account_id
    ON CONFLICT(user_id) DO UPDATE SET role='admin',active=true;
END $$;
