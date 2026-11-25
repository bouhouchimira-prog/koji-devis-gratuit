-- Devis gratuit : leads (un par email) et sessions de chat.
-- RLS activé sans aucune politique publique : seul le serveur, avec la clé
-- service role, lit et écrit ces tables.

create table if not exists public.devis_gratuit_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  company_name text,
  metier text,
  consent_at timestamptz not null,
  consent_text text not null,
  quote_summary jsonb,
  source text,
  converted_user_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.devis_gratuit_sessions (
  id uuid primary key,
  ip_hash text not null,
  messages_count integer not null default 0,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists devis_gratuit_sessions_ip_day
  on public.devis_gratuit_sessions (ip_hash, created_at);

alter table public.devis_gratuit_leads enable row level security;
alter table public.devis_gratuit_sessions enable row level security;

-- Les trois chiffres de suivi :
--   sessions commencées : select count(*) from devis_gratuit_sessions;
--   devis terminés      : select count(*) from devis_gratuit_sessions where finished_at is not null;
--   emails collectés    : select count(*) from devis_gratuit_leads;
