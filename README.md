# DC Daily Checklist — Supabase edition

This standalone Next.js application runs locally or on a host that supports Next.js and Node.js 22 or later. PostgreSQL is hosted in your existing Supabase project:
https://scxvvvjlhewxjsezkyvk.supabase.co

## Start on Windows

Extract the ZIP first, then double-click `Start-Checklist.bat`. Node.js 22 or later must be installed. The first launch creates `.env.local` and opens it in Notepad if your publishable key is missing. Save your key, then double-click the launcher again. It installs dependencies when needed, selects an available local port, and opens the app in your default browser once ready. Keep the launcher window open; press Ctrl+C to stop. Your Supabase schema and approved login account still need the one-time setup below.

## Admin users and roles

See ADMIN-SETUP.md for the role upgrade. Existing installations run supabase/roles-upgrade.sql followed by supabase/bootstrap-admin.sql. Add the server-only SUPABASE_SECRET_KEY and restart. The bootstrap uses your existing sameer.shaikh@detasad.com login.

## Setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local`. Fill in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` using your project's publishable key. The project URL is already filled in. A legacy anon key is also compatible if your project has not adopted publishable keys. Never place a secret or service-role key in a `NEXT_PUBLIC_` variable.
3. In the Supabase SQL editor, inspect the existing schema and run `supabase/schema.sql` once. It creates two app-specific tables and Row Level Security policies. It intentionally fails instead of replacing a table if those names already exist.
4. Create or use an existing email/password account in Supabase Authentication. Run supabase/bootstrap-admin.sql to approve the first Admin, changing its email only if needed. A Supabase dashboard login is separate from an app Auth account. Approved accounts have role-specific access. Admins manage other users through the app.
5. Run `npm run dev` and open http://localhost:3000. Sign in with the approved account.

## Production

Run `npm run build`, then `npm start`. On a Next.js host, configure the two public environment variables before building and the server-only SUPABASE_SECRET_KEY for Admin user management. The project includes a lockfile and standard Node.js build configuration. For self-hosting, use HTTPS for external access. The app does not rely on ChatGPT Sites authentication or Cloudflare bindings.

## Existing records

The original Sites application remains unchanged and retains its existing data. Live data has not yet been transferred. Do not switch users away from the original application until a complete raw backup has been imported and verified, with writes paused during the final cutover.

The source database contains inspection, repair (`resolve`), and custom-question records. A complete backup must include all three kinds as raw rows with `id`, `created_at` (or `createdAt`), and the exact string `payload`. The normal inspections API alone is not a complete backup because it excludes custom questions.

Put the raw JSON backup outside this source folder or in ignored `backups/`. To validate it:

```sh
npm run import:records -- path/to/backup.json
```

To import, add a server-only `SUPABASE_SECRET_KEY` to `.env.local` and run:

```sh
npm run import:records -- path/to/backup.json --apply
```

The import preserves IDs, millisecond timestamps, inspector names, checklist snapshots, readings and remarks. It compares existing rows exactly, stops on conflicts, never updates/deletes existing records, and verifies every imported row. You can rerun it safely after an interruption. Keep the server-only secret configured if you use the Admin module. Normal checklist operations use the publishable key and signed-in sessions. Admin user management uses the server-only secret.

## Checks and retained features

Run `npm test`, `npm run typecheck`, and `npm run build`. All inspection validation, Riyadh dates, completion history, cooling charts, custom checklist questions, repairs, CSV exports, demo data, and PDF downloads are retained. PDF inspector names and filtered review exports use the same generator as the original app. Database reads paginate through all rows.

The app verifies sessions server-side with Supabase Auth and checks approved membership before database access. RLS independently enforces the role, active status and inspector ownership. Public signup alone grants no checklist access. Normal clients cannot edit membership, update records, or delete history.

The role upgrade and initial Admin account are configured in your selected Supabase project. The original three Sites inspections have been imported and verified. Local and Sites connect to the same project and share records, users, roles and Microsoft settings.

## Fault photos and Teams notifications

Every newly submitted faulty item requires fault details and at least one uploaded picture. Choose JPEG, PNG or WebP, up to 5 MB per picture and three pictures per item. Photos are saved in the configured company SharePoint library through Power Automate; Supabase stores only protected file references. Photos appear in saved inspection details and filtered check-detail review. Existing inspections without pictures remain readable.

Admins can edit the Teams channel link, SharePoint library link, existing photo folder, private gateway workflow URL, Test/Live mode and enable switches under Admin users → Microsoft 365 settings. Both hosts use these same settings. Test notifications are labelled TEST. Historical photos retain their original configuration reference when destinations change. The saved webhook URL is never returned to browsers.

The selected Supabase project already has the photo schema and dc-checklist-microsoft Edge Function installed. For a new project, apply supabase/photos-upgrade.sql and supabase/pdf-notifications-upgrade.sql after the role schema and deploy the Microsoft gateway function before enabling photos. Use the prepared Power Automate gateway package, connect SharePoint and Teams, and keep its signed webhook in server-only configuration. The gateway must return confirmed JSON results; HTTP 202 alone is not treated as a saved photo.

Submission saves the inspection first, then generates the same complete inspection PDF (including the inspector name), uploads it to the configured SharePoint folder, and posts a Teams message with a View inspection PDF link, inspector, date, shift, area, faults and a link to the inspection. A notification failure preserves the inspection. Submitters/admins can retry failed notifications from saved inspection details; check channel/run history first after an interrupted delivery to avoid duplicates. Disabling uploads prevents new faulty submissions until uploads are re-enabled. Removing a picture from a draft does not delete its SharePoint file.

Power Automate uses its owner's Microsoft connection. If Microsoft expires that connection, reconnect it in Power Automate. Configure the real channel/library and switch from Test to Live before live operation.

Admins can use Manage users → Reset password to set and confirm a new 12–128 character password directly in Supabase. Share it with the user securely. Roles, active status and inspection history are preserved. Only approved active admins can perform this operation; accounts outside the checklist membership cannot be targeted.


## Company branding and locations
One company can have multiple locations and checklist areas. Admin users → Company name & logo lets admins save a name and PNG/JPEG logo (up to 2 MB). Manage checklists → Company locations & checklist areas adds a location and area, either copying an existing checklist with independent question IDs or starting empty. Add questions before inspecting an empty area. Location filters, checklist selectors, reports and completion history use the shared definitions. New areas are not counted as missed before their creation date. Company branding is included in PDFs; newly submitted inspections snapshot company and location names.
For a new project, apply supabase/company-upgrade.sql after the roles upgrade. Both hosts share these settings through Supabase. Original checklists, inspections and user roles are preserved.


## Profile drawer and demo setting
The compact profile icon opens a reusable right-side overlay with name, email, role, Riyadh date/time, available Admin settings and Sign Out. Escape, outside click and close controls dismiss it; keyboard focus is contained and restored. It does not reserve dashboard width.
Admin users → Settings → Enable Demo Data is saved in Supabase, default OFF. Apply supabase/demo-settings-upgrade.sql after company-upgrade.sql for a new project. Approved clients receive settings changes through Supabase Realtime, with focus checks and periodic fallback. Disabled sample URLs/API requests are rejected server-side. Sample records are generated separately, never stored, and cannot be posted as real inspections. Live data excludes demo markers. Sample exports are labelled DEMO DATA; access is checked again before export. Branding updates preserve this setting.


## Issue tickets (20 October 2026)
The connected project is already upgraded. For a separate database, apply company, photos and team-access upgrades first, then supabase/issue-workflow.sql once. Never rerun it against an already upgraded project. Tickets use a continuous company-wide sequence with the Riyadh reporting date. Start work, Complete repair, and Supervisor/Admin verification are recorded in Issues and repair history. New checklist faults require photos; active faults reuse their evidence and cannot become Normal until Closed. Repair photos use the existing SharePoint workflow. Issue updates send Teams messages with fields and photo links. Inline image preview depends on Teams/SharePoint permissions; photo links remain available. Northflank needs a new source deployment.

## Admin amendments to submitted inspections
Admins can open Inspection history, view a round, and select **Amend submitted checklist**. A reason is required. Original inspector, submission time, photos and reported faults are retained; each revision stores before/after snapshots and the admin/time. Date, shift, answers, readings and remarks can be corrected. New faults require photos and create or reuse a ticket. Existing faults cannot be cleared through editing; use repair verification. Corrected PDF downloads identify the revision. Teams receives a correction notice linking to the current checklist and amendment history; original submission notification/PDF use the original snapshot.
The connected database has already been upgraded. Separate installations must run supabase/inspection-amendments.sql once after supabase/issue-workflow.sql and deploy the included updated Microsoft Edge function. No delete/void feature is included. Northflank requires a new source deployment.

## Reading dates and times
Temperature and humidity values capture separate UTC entry timestamps when entered, displayed consistently in Riyadh time (AST) on the dashboard, Cooling readings, inspection details, CSV exports and newly generated PDFs. Existing records have no per-reading timestamp: their known submission time is shown with `(submitted)`, not presented as an exact measurement time. Editing a remark does not change a reading timestamp; clearing and entering a reading again captures a new entry time. Admin amendments retain the original reading timestamp as part of the audit trail. Already-uploaded historical PDFs are unchanged; download again to generate the updated layout.

## Shift timings and issue drill-down (27 October 2026)
Confirmed Riyadh schedule: Shift 1 08:00–17:00, Shift 2 14:00–23:00, Shift 3 23:00–08:00 next day. Admin users → Shift timings allows editing; overlaps are supported and shift selection stays manual. Apply supabase/shift-timings-upgrade.sql once on a separate database (already applied to the connected project). New inspections snapshot their shift hours, so later schedule changes do not rewrite their meaning. Older records without a snapshot show the current schedule with a label. Inspection dates remain calendar dates; this update does not change submission-date rules.
Click the equipment name, issue row or View issue on the dashboard to open the selected ticket. Checklist history from first report shows every linked round in chronological order, with dates, shift hours, inspector, readings, notes and photos. Expand Show all checklist items for each round or Open full inspection; Back to issue returns to the ticket. History is paged 20 rounds at a time without excluding older records. Separate fault cycles on the same item are not mixed. Original records remain unchanged; repeated tracking-reference text is cleaned only for display.

## Issue table popup correction
Clicking a dashboard issue now opens a modal table over the dashboard, without changing the page. Rows are ordered by inspection date and shift and include the inspector, status, readings, remarks and photo controls. View all items expands that specific checklist inside the same popup. Close, Escape or clicking the backdrop dismisses the popup and restores focus. Open Issues retains an explicit Manage repair action for the existing repair workflow; View issue opens the popup. No inspection or issue data was modified by this layout correction.


### Issue resolution PDFs
After Verify and close, the issue popup prepares a customer-facing resolution PDF. Open Issues, select Closed or All, click the issue name or number, then Download resolution PDF. Reports use saved issue/repair/verification history, company branding, AST timestamps and available original/after-repair photos. Missing photos are identified and can be retried. Historical closures without verification records are labelled accordingly. Reports are generated on demand in the signed-in browser; they are not emailed to customers or stored as a separate server file. PDF generation errors do not undo issue closure.
