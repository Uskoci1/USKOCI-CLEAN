-- 06 — AI persistence
--
-- KEEP iz donora, gotovo bez izmene. Ovaj model već sprovodi kanon:
--
--   status  razdvaja predlog od potvrde
--   source  razdvaja ono što je korisnik REKAO od onoga što je AI ZAKLJUČIO
--   scope   izdvaja NEED_DRAFT
--   superseded_at  omogućava ispravku bez brisanja istorije
--
-- Zbog superseded_at chat i live kartica mogu da budu dve projekcije
-- ISTOG stanja. Bez njega bi kartica morala svoj state — što je zabranjeno.

create table if not exists public.ai_conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('NEED_INTAKE','APPLICATION','PROFILE')),
  status text not null default 'OPEN' check (status in ('OPEN','COMPLETED','ABANDONED')),
  bound_need_id uuid references public.needs(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz
);

create index if not exists ai_conversations_account_idx
  on public.ai_conversations (account_id, created_at desc);

create table if not exists public.ai_structured_facts (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  subject_need_id uuid references public.needs(id) on delete cascade,

  fact_key text not null check (char_length(btrim(fact_key)) between 1 and 160),
  fact_value jsonb,

  -- AI nikad ne upisuje CONFIRMED. To može samo ljudska potvrda.
  status text not null check (status in ('CONFIRMED','INFERRED','UNKNOWN','NEEDS_CONFIRMATION')),
  source text not null check (source in ('EXPLICIT_USER_ANSWER','CONFIRMED_PROFILE','AI_INFERENCE','SYSTEM_DERIVED')),
  scope text not null check (scope in ('STABLE_PROFILE','LIVE_OVERRIDE','NEED_DRAFT')),

  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  -- Osnov za tvrdnju. Bez citata se ne može proveriti šta je AI zaključio.
  evidence_excerpt text,

  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  -- Ispravka potiskuje staru činjenicu umesto da je prepiše.
  superseded_at timestamptz,
  superseded_by uuid references public.ai_structured_facts(id) on delete set null,

  created_at timestamptz not null default statement_timestamp(),

  check (status <> 'CONFIRMED' or confirmed_at is not null),
  check (source <> 'AI_INFERENCE' or evidence_excerpt is not null)
);

-- Jedna živa činjenica po ključu u okviru razgovora.
create unique index if not exists ai_structured_facts_one_live_per_key
  on public.ai_structured_facts (conversation_id, fact_key)
  where superseded_at is null;

create table if not exists public.ai_action_proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  action_kind text not null,
  payload jsonb not null,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','CONFIRMED','REJECTED','EXECUTED')),
  decided_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (status = 'PROPOSED' or decided_at is not null)
);
