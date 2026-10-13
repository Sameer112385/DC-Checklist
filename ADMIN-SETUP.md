# Admin module and roles

For an existing installation, run supabase/roles-upgrade.sql in the Supabase SQL Editor. It is safe to rerun and preserves existing records and memberships. Run supabase/bootstrap-admin.sql next to make the existing sameer.shaikh@detasad.com account the first active Admin. Change the email only if you intend to use a different admin account. For a new database, run supabase/schema.sql first instead of the upgrade.

Add the server-only SUPABASE_SECRET_KEY to .env.local (or .env) and restart. Hosted deployments need the same value in their server environment. Use a Supabase secret key or legacy service-role key. Never prefix it NEXT_PUBLIC_. The server verifies the signed-in user's current database role before using the privileged key.

Sign in as the Admin and open **Admin users**. Enter a name, email, initial password and role to create a new login account. The server creates it in Supabase Auth and saves its protected role in dc_checklist_members. Give the password to the user securely. Passwords must be 12–128 characters and satisfy any additional Supabase password policy.

To approve someone who already has a Supabase Auth login, select **Add existing Supabase account**. It adds membership without resetting their password. For existing checklist members, edit the table instead.

The table supports role changes, name updates and disabling accounts. Disabled users cannot read or write checklist data, even with an existing login token. They can still authenticate, but the app denies access. Disabling preserves records. This module does not delete users or history. Your own admin role cannot be lowered or disabled. Changes use a database lock and protect the last active admin.

| Role | Access |
| --- | --- |
| Inspector | Submit inspections; view/export their own history and readings; view related repairs. |
| Supervisor | Review/export all inspections; view full completion history; record repairs. |
| Admin | All features; manage checklists; create, approve and disable users; change roles. |

New inspections and repairs record the protected profile name; caller-supplied names are ignored. Existing payloads and names stay unchanged. Pre-upgrade and imported inspections have no account owner and remain visible to Supervisors/Admins. They are never assigned automatically by name, which could give access to the wrong person. Shared question definitions and repair records remain readable by Inspectors.

Test with npm test, npm run typecheck and npm run build. Tests exercise PostgreSQL RLS, role management, disabled access, rollback of new unapproved Auth accounts and existing-data preservation in an isolated database. Live account creation requires configured Supabase Auth and a server secret.
