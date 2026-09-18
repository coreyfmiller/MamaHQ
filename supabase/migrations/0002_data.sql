-- MamaHQ data tables: logs, appointments (+ questions), mom state/items,
-- memories, captures. All family-scoped, all RLS-protected via is_family_member().
-- Shapes mirror the client stores so the mapping stays 1:1.

-- ============================================================
-- Logs (feed / sleep / diaper / pumping / medication)
-- ============================================================
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('feed','sleep','diaper','pumping','medication')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,          -- sleep: running when null
  amount text,                    -- feed/pumping, e.g. "4 oz"
  side text,                      -- 'left' | 'right'
  diaper_type text,               -- 'wet' | 'dirty' | 'mixed'
  note text
);
create index if not exists logs_family_created on public.logs(family_id, created_at desc);

-- ============================================================
-- Appointments + their questions
-- ============================================================
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  when_at timestamptz not null,
  location text,
  reminders_on boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists appointments_family_when on public.appointments(family_id, when_at);

create table if not exists public.appointment_questions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  text text not null,
  asked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Mom: per-day mood + her tasks and doctor questions
-- ============================================================
-- Mood keyed by day, one row per (family, day).
create table if not exists public.mom_moods (
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  mood text not null check (mood in ('tired','okay','good','great')),
  updated_at timestamptz not null default now(),
  primary key (family_id, day)
);

create table if not exists public.mom_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('task','question')),
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mom_items_family_kind on public.mom_items(family_id, kind);

-- ============================================================
-- Memories (photo + caption)
-- ============================================================
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  photo text not null,     -- downscaled data URL (small)
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists memories_family_created on public.memories(family_id, created_at desc);

-- ============================================================
-- Inbox captures (raw + proposed items JSON + status)
-- ============================================================
create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  source text not null check (source in ('type','voice','photo','gmail')),
  raw_text text not null,
  status text not null default 'proposed' check (status in ('proposed','committed','dismissed')),
  items jsonb not null default '[]'::jsonb,   -- ProposedItem[]
  created_at timestamptz not null default now()
);
create index if not exists captures_family_created on public.captures(family_id, created_at desc);

-- ============================================================
-- RLS: everything scoped to family membership
-- ============================================================
alter table public.logs enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_questions enable row level security;
alter table public.mom_moods enable row level security;
alter table public.mom_items enable row level security;
alter table public.memories enable row level security;
alter table public.captures enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'logs','appointments','appointment_questions','mom_moods','mom_items','memories','captures'
  ]
  loop
    execute format('drop policy if exists %I_all on public.%I;', t, t);
    execute format(
      'create policy %I_all on public.%I for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));',
      t, t
    );
  end loop;
end $$;
