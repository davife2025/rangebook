-- Rangebook — Supabase schema
-- This is a cache + product-data layer, NOT the authority for what an agent
-- can do. Session permissions are always re-verified against Altana's
-- Keystore before being trusted; nothing here is a substitute for that read.

create extension if not exists "uuid-ossp";

create type agent_category as enum (
  'rebalancing',
  'grid_trading',
  'yield_optimisation',
  'health_factor_monitoring'
);

-- One per deployed agent (one per category, to start).
create table agents (
  id uuid primary key default uuid_generate_v4(),
  category agent_category not null,
  name text not null,
  tagline text not null,
  description text not null,
  erc8004_agent_id text,             -- identity registered by Agent Studio on deploy
  agent_wallet_address text,         -- the agent's own operating wallet (TWAK), for its own economy
  skills text[] not null,            -- Altana skill(s) this agent composes, e.g. {'pancakeswap-liquidity'}
  status text not null default 'draft' check (status in ('draft', 'testnet', 'live')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Live-ish numbers per agent, refreshed on an interval by apps/api.
-- This is what makes marketplace cards show real data instead of a category label.
create table agent_metrics (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  metric_key text not null,          -- e.g. 'apr', 'health_factor', 'in_range', 'grid_fill_rate'
  metric_value numeric,
  metric_label text,                 -- human-readable, e.g. "8.2% on Venus"
  source text not null,              -- '8004scan' | 'chain_read' | 'protocol_subgraph'
  recorded_at timestamptz not null default now()
);
create index agent_metrics_agent_id_idx on agent_metrics(agent_id, recorded_at desc);

-- Fast-read mirror of an Altana session. The dashboard reads this for instant
-- paint, then verifies against Keystore before showing an actionable revoke
-- button — never trust this table alone for a revoke decision.
create table sessions_cache (
  id uuid primary key default uuid_generate_v4(),
  user_wallet_address text not null,
  agent_id uuid not null references agents(id),
  session_key_address text not null, -- the granted session key's address
  calls jsonb not null,              -- allowlisted {to, selector[]} entries
  spend_limit numeric,
  spend_token text,
  spend_period text,                 -- 'day' | 'week' | 'total'
  expires_at timestamptz not null,
  revoked_at timestamptz,
  keystore_tx_hash text not null,    -- the grantSession tx — the actual proof
  created_at timestamptz not null default now()
);
create index sessions_cache_user_idx on sessions_cache(user_wallet_address);

-- Rebalancing: which LP position a session is allowed to manage. Solves
-- "we don't know whose position this is" — separate from, and in addition
-- to, the actual Infinity chain calls (see packages/agent-rebalancing).
create table rebalancing_positions (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id),
  user_wallet_address text not null,
  position_token_id text not null,        -- PancakeSwap Infinity CL position NFT id
  position_manager_address text not null, -- CLPositionManager for the deployment this position is on
  range_width_ticks integer not null default 2000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_wallet_address, position_token_id)
);

-- Grid Trading: the grid a session is allowed to run. Same story — this is
-- state storage, not the swap execution itself.
create table grid_configs (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id),
  user_wallet_address text not null,
  base_token text not null,
  quote_token text not null,
  universal_router_address text not null,
  levels jsonb not null,              -- [{price, side, filled}], see packages/agent-grid-trading/src/grid.ts
  amount_per_level numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The TermiX-required Agent Advantage Report: >=3 real tasks, run both ways.
create table advantage_report_tasks (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id),
  task_title text not null,
  task_description text not null,
  is_trading_stock_or_security boolean not null default false,
  with_agent_time_seconds integer,
  with_agent_cost_usd numeric,
  with_agent_output text,            -- summary; attach full output as a linked file
  with_agent_output_url text,
  with_agent_quality_score numeric check (with_agent_quality_score between 1 and 5),
  without_agent_time_seconds integer,
  without_agent_cost_usd numeric,
  without_agent_output text,
  without_agent_output_url text,
  without_agent_quality_score numeric check (without_agent_quality_score between 1 and 5),
  quality_rubric_notes text,         -- why each score landed where it did — see ADVANTAGE_REPORT_METHODOLOGY.md
  -- Trading-specific: TermiX weights trading/stock/security tasks on a
  -- real record (win rate, window, risk), not just the with/without pair
  -- above — nullable, only meaningful when is_trading_stock_or_security.
  win_rate_pct numeric,
  risk_description text,
  window_start timestamptz,
  window_end timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Marketplace accounts (Supabase Auth), linked to the user's Altana wallet.
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  altana_wallet_address text,
  display_name text,
  created_at timestamptz not null default now()
);

alter table agents enable row level security;
alter table agent_metrics enable row level security;
alter table sessions_cache enable row level security;
alter table advantage_report_tasks enable row level security;
alter table user_profiles enable row level security;
alter table rebalancing_positions enable row level security;
alter table grid_configs enable row level security;

-- Agents, metrics, and the advantage report are public marketplace data.
create policy "agents are publicly readable" on agents for select using (true);
create policy "agent metrics are publicly readable" on agent_metrics for select using (true);
create policy "advantage report is publicly readable" on advantage_report_tasks for select using (true);

-- A user only ever sees their own sessions and profile.
create policy "users read their own sessions" on sessions_cache
  for select using (auth.jwt() ->> 'wallet_address' = user_wallet_address);
create policy "users read their own profile" on user_profiles
  for select using (auth.uid() = id);
create policy "users update their own profile" on user_profiles
  for update using (auth.uid() = id);
create policy "users manage their own tracked positions" on rebalancing_positions
  for all using (auth.jwt() ->> 'wallet_address' = user_wallet_address);
create policy "users manage their own grid configs" on grid_configs
  for all using (auth.jwt() ->> 'wallet_address' = user_wallet_address);

-- Writes to agents/metrics/sessions_cache go through apps/api using the
-- service role key, which bypasses RLS by design — never expose that key
-- to apps/web.
