-- The Snus Life Internal Dashboard schema draft
-- Run this in Supabase SQL editor or convert into migrations.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role text not null default 'admin',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  email text not null unique,
  role_title text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_staff_members_updated_at
before update on public.staff_members
for each row execute function public.set_updated_at();

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  meeting_link text,
  internal_notes text,
  status text not null default 'planned' check (status in ('planned', 'confirmed', 'done', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_calendar_events_starts_at on public.calendar_events(starts_at);
create index if not exists idx_calendar_events_status on public.calendar_events(status);

create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

create table if not exists public.calendar_event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  email text not null,
  display_name text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_calendar_event_attendees_event on public.calendar_event_attendees(event_id);

create table if not exists public.holiday_balances (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null unique references public.staff_members(id) on delete cascade,
  annual_allowance numeric(6,2) not null default 0,
  used_holiday numeric(6,2) not null default 0,
  remaining_holiday numeric(6,2) not null default 0,
  credited_holiday numeric(6,2) not null default 0,
  removed_holiday numeric(6,2) not null default 0,
  manual_adjustments numeric(6,2) not null default 0,
  pending_requests integer not null default 0,
  approved_requests integer not null default 0,
  rejected_requests integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_holiday_balances_updated_at
before update on public.holiday_balances
for each row execute function public.set_updated_at();

create table if not exists public.holiday_requests (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  days_requested numeric(6,2) not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_holiday_requests_staff on public.holiday_requests(staff_member_id);
create index if not exists idx_holiday_requests_status on public.holiday_requests(status);

create trigger set_holiday_requests_updated_at
before update on public.holiday_requests
for each row execute function public.set_updated_at();

create table if not exists public.holiday_adjustments (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('credit', 'remove', 'manual')),
  amount_days numeric(6,2) not null,
  reason text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_holiday_adjustments_staff on public.holiday_adjustments(staff_member_id);

create table if not exists public.dashboard_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  default_home_range text not null default 'mtd',
  compact_mode boolean not null default false,
  pinned_modules text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_dashboard_preferences_updated_at
before update on public.dashboard_preferences
for each row execute function public.set_updated_at();

create table if not exists public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_integration_secrets_updated_at
before update on public.integration_secrets
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.staff_members enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_event_attendees enable row level security;
alter table public.holiday_balances enable row level security;
alter table public.holiday_requests enable row level security;
alter table public.holiday_adjustments enable row level security;
alter table public.dashboard_preferences enable row level security;
alter table public.integration_secrets enable row level security;

-- Example policy set for authenticated internal users.
-- Tighten further by role if needed.
create policy if not exists "authenticated read profiles"
on public.profiles for select to authenticated using (true);

create policy if not exists "authenticated read staff"
on public.staff_members for select to authenticated using (true);

create policy if not exists "authenticated read calendar"
on public.calendar_events for select to authenticated using (true);

create policy if not exists "authenticated read attendees"
on public.calendar_event_attendees for select to authenticated using (true);

create policy if not exists "authenticated read holiday"
on public.holiday_requests for select to authenticated using (true);

create policy if not exists "authenticated read balances"
on public.holiday_balances for select to authenticated using (true);

create policy if not exists "authenticated read adjustments"
on public.holiday_adjustments for select to authenticated using (true);

create policy if not exists "owner preferences"
on public.dashboard_preferences for all to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());
