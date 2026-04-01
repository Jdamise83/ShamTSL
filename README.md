# The Snus Life Internal Dashboard

Private operations dashboard built with Next.js App Router, TypeScript, Tailwind, shadcn-style UI components, Supabase Auth + Postgres, FullCalendar, and Recharts.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn-style component architecture
- Supabase Auth + Supabase Postgres
- FullCalendar
- Recharts
- Vercel-ready deployment

## Features

- Auth-protected private app area
- Left navigation modules: Home, Calendar, Holidays, Google Ads, SEO, GA4, Unleashed, Settings
- Premium dashboard UI with grouped KPI rows and blue range labels
- Fully interactive meeting calendar:
  - day/week/month views
  - create/edit/delete
  - attendee assignment
  - meeting metadata and notes
  - drag/drop and resize support
- Holiday management workflow:
  - per-staff balances and allowances
  - request submission
  - approve/reject workflow
  - credits/removals/manual adjustments
  - audit log
- Service layer pattern with typed providers and mock data adapters
- Server-side integration architecture for Google Ads, Search Console, GA4, and Unleashed

## Project Structure

```text
app/
  (auth)/login
  (protected)/home
  (protected)/calendar
  (protected)/holidays
  (protected)/google-ads
  (protected)/seo
  (protected)/ga4
  (protected)/unleashed
  (protected)/settings
  api/calendar/events
  api/holidays
src/
  components/
    dashboard/
    layout/
    calendar/
    holiday/
    ui/
  lib/
    supabase/
  server/
    services/
    data/
  types/
supabase/
  schema.sql
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

All secrets must remain server-side. Do not expose service credentials in client code.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure `.env.local` with Supabase and provider placeholders.

3. Run development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. In Supabase Auth, create your initial admin user.
4. Add values to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Optional: tighten RLS policies by admin role in `profiles.role`.

## Vercel Deployment

1. Push repository to GitHub.
2. Import project in Vercel.
3. Add every variable from `.env.example` in Vercel Project Settings > Environment Variables.
4. Deploy.

## Server-Side Integration Pattern

Current external data modules use typed mock providers:

- `src/server/services/google-ads-service.ts`
- `src/server/services/seo-service.ts`
- `src/server/services/ga4-service.ts`
- `src/server/services/unleashed-service.ts`

To connect real APIs later:

1. Create a real provider class in each service file.
2. Keep third-party API calls in server-only modules (`src/server/services` or API routes).
3. Read credentials from env variables only.
4. Swap provider instantiation from mock provider to real provider.

## Security Notes

- Auth middleware protects private routes.
- Protected layout re-checks server session.
- Third-party API credentials are never sent to the browser.
- Internal API routes mediate client interactions.

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```
