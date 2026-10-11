# Aventus Realtors CRM

Lead management CRM for Aventus Realtors, built from the *Aventus Realtors CRM Blueprint* (Phase 1).
It runs on **Next.js** (hosted on **Vercel**) with **Supabase** (Postgres, Auth, Storage, pg_cron).

The one rule everything is built around: **no open lead can exist without a next follow up date.**
It is enforced in the database itself, so it can't be skipped from the browser.

## What's included (Phase 1)

| Area | Features |
|---|---|
| Roles | Founder (admin) and Sales agent. Row level security means agents only ever see their own leads, deals and numbers |
| Lead intake | Excel/CSV upload wizard (column auto-mapping, preview, duplicate and invalid phone report, split per agent) · manual Instagram / walk-in leads · Meta Lead Ads webhook |
| Distribution | Round robin by count, skips agents on leave, editable order |
| Dedupe | Phone is the unique key (UAE numbers normalised to +971). A repeat lead adds a "came in again" note and notifies the owner; a Lost lead reopens as New |
| Stages | New → Contacted → Shortlisting → Meeting → Negotiation → Won / Lost, each with its required fields (requirement card, shortlisted unit, meeting, selected unit, deal form, lost reason). Skipping forward is allowed; moving back needs a note |
| Follow up engine | Mandatory next follow up on every call and stage change · My Day (Overdue, Due today, New untouched) · task queue ("Start calls") · quick follow up chips plus suggested cadence (day 1, 3, 7, 15, 30) |
| Call logging | Connected / Not answered / Busy / Switched off / Wrong number. Connected needs a note; Wrong number closes the lead as Not genuine |
| Automations (every 15 min) | First call SLA · untouched 24h reassignment (Instagram leads are flagged to the founder instead) · 6 unanswered attempts → Lost (Unreachable) · stale at 7 days · recycle pool at 30 days · Future buyer reopens after 60 days · commission overdue alerts · 9 AM agent summary · 7 PM founder team summary |
| Deals | Deal form with developer default commission %, split agent, documents (private storage), Pending → Received (founder only), cancellation removes the commission from totals |
| Dashboards | Founder: agent table, pipeline funnel, commission by month, lead source performance with cost per deal, alerts, leaderboard, rejection reasons. Agent: own numbers. Filters: Today / Week / Month / Custom |
| UX | Mobile first (bottom tabs, floating add button, bottom sheets, swipe a card right to log a call or left to reschedule, tap to call then log, WhatsApp click to chat). Desktop: sidebar, dense tables, LeadSquared-style preview panel, keyboard shortcuts (`/`, `j`, `k`). Installable PWA |

All time rules, lost reasons, rejection reasons and the developer list are editable in **Settings**.

---

## Deploy (about 15 minutes)

### 1. Supabase: create the database

1. Open your **Aventus Realtors** project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** → **New query**. Paste in and **Run** each of these files, in this order:
   1. `supabase/migrations/20261011000001_core.sql`
   2. `supabase/migrations/20261011000002_cron.sql`
   3. `supabase/migrations/20261011000003_storage.sql`

   If the second file fails with a pg_cron error, enable it under **Database → Extensions → pg_cron** and run it again.

   *(If you use the Supabase CLI instead, run `supabase link --project-ref <ref>` and then `supabase db push`.)*
3. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Agents are created by the founder from inside the CRM.
4. Go to **Project Settings → API** and copy three values: the **Project URL**, the **anon public** key and the **service_role** key.

### 2. Vercel: host the app

1. At [vercel.com/new](https://vercel.com/new), import the GitHub repo `jaziljazzz/jazil`. The framework (Next.js) is detected automatically.
2. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |
   | `NEXT_PUBLIC_APP_TIMEZONE` | `Asia/Dubai` |

3. Click **Deploy**.
4. Back in Supabase, open **Authentication → URL Configuration** and set **Site URL** to your Vercel URL.

### 3. First login

1. Open your Vercel URL. The first visit shows **Set up**: create the founder account.
2. In **Settings**, add your developers and their default commission %.
3. In **Team**, add each agent (name, email, mobile, temporary password). Agents can sign in with either their email or their mobile number.
4. In **Upload leads**, import your first bought list.
5. Agents open the URL on their phone and choose **Add to Home Screen**, so it works like an app.

### 4. Meta Lead Ads (optional, Phase 2)

Add `META_VERIFY_TOKEN` (any random string), `META_APP_SECRET` and `META_PAGE_ACCESS_TOKEN` (a Page token with `leads_retrieval`) in Vercel. Then in Meta for Developers, subscribe the Page's **leadgen** webhook to `https://<your-domain>/api/meta/webhook`. **Settings → Meta Lead Ads connection** shows a checklist of what's done.

---

## Local development

```bash
cp .env.example .env.local      # fill in the Supabase values
npm install
npm run dev
```

With the Supabase CLI and Docker, `npx supabase start` runs a full local stack and applies the migrations automatically.

## Project structure

```
supabase/migrations/   Schema, row level security, business rules (functions), cron jobs, storage
src/app/(app)/         Screens: today, queue, leads, leads/[id], pipeline, deals, dashboard,
                       upload, recycle, team, settings, notifications, me
src/app/api/meta/      Meta Lead Ads webhook
src/components/        UI kit, action sheets (log call, stage, add lead, mark won), timeline, stage path
src/lib/               Supabase clients, types, formatting (Dubai timezone, AED)
```

To use Aventus's own brand colour, change `--color-brand` in `src/app/globals.css`.
