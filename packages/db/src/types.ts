// Hand-written to match schema.sql. Once the Supabase project exists, swap
// this for the generated file:
//   pnpm supabase gen types typescript --project-id <id> > src/types.ts

export type AgentCategory =
  | "rebalancing"
  | "grid_trading"
  | "yield_optimisation"
  | "health_factor_monitoring";

export interface Agent {
  id: string;
  category: AgentCategory;
  name: string;
  tagline: string;
  description: string;
  erc8004_agent_id: string | null;
  agent_wallet_address: string | null;
  skills: string[];
  status: "draft" | "testnet" | "live";
  created_at: string;
  updated_at: string;
}

export interface AgentMetric {
  id: string;
  agent_id: string;
  metric_key: string;
  metric_value: number | null;
  metric_label: string | null;
  source: "8004scan" | "chain_read" | "protocol_subgraph";
  recorded_at: string;
}

export interface SessionCacheRow {
  id: string;
  user_wallet_address: string;
  agent_id: string;
  session_key_address: string;
  calls: { to: string; selectors: string[] }[];
  spend_limit: number | null;
  spend_token: string | null;
  spend_period: "day" | "week" | "total" | null;
  expires_at: string;
  revoked_at: string | null;
  keystore_tx_hash: string;
  created_at: string;
}

export interface AdvantageReportTask {
  id: string;
  agent_id: string;
  task_title: string;
  task_description: string;
  is_trading_stock_or_security: boolean;
  with_agent_time_seconds: number | null;
  with_agent_cost_usd: number | null;
  with_agent_output: string | null;
  with_agent_output_url: string | null;
  with_agent_quality_score: number | null;
  without_agent_time_seconds: number | null;
  without_agent_cost_usd: number | null;
  without_agent_output: string | null;
  without_agent_output_url: string | null;
  without_agent_quality_score: number | null;
  quality_rubric_notes: string | null;
  win_rate_pct: number | null;
  risk_description: string | null;
  window_start: string | null;
  window_end: string | null;
  notes: string | null;
  created_at: string;
}

export interface RebalancingPosition {
  id: string;
  agent_id: string;
  user_wallet_address: string;
  position_token_id: string;
  position_manager_address: string;
  range_width_ticks: number;
  created_at: string;
  updated_at: string;
}

export interface GridLevelRow {
  price: number;
  side: "buy" | "sell";
  filled: boolean;
}

export interface GridConfigRow {
  id: string;
  agent_id: string;
  user_wallet_address: string;
  base_token: string;
  quote_token: string;
  universal_router_address: string;
  levels: GridLevelRow[];
  amount_per_level: string; // raw smallest-unit integer as text — whether Supabase-js
  // returns numeric columns as string or number for values this large isn't confirmed;
  // typing it as string is the safe assumption. BigInt() accepts either at the one
  // call site that consumes this (rangebookExecutor.ts), so this doesn't need to be
  // "fixed" so much as not quietly promising more precision than is confirmed.
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  altana_wallet_address: string | null;
  display_name: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      agents: { Row: Agent; Insert: Partial<Agent>; Update: Partial<Agent> };
      agent_metrics: { Row: AgentMetric; Insert: Partial<AgentMetric>; Update: Partial<AgentMetric> };
      sessions_cache: { Row: SessionCacheRow; Insert: Partial<SessionCacheRow>; Update: Partial<SessionCacheRow> };
      advantage_report_tasks: {
        Row: AdvantageReportTask;
        Insert: Partial<AdvantageReportTask>;
        Update: Partial<AdvantageReportTask>;
      };
      user_profiles: { Row: UserProfile; Insert: Partial<UserProfile>; Update: Partial<UserProfile> };
      rebalancing_positions: {
        Row: RebalancingPosition;
        Insert: Partial<RebalancingPosition>;
        Update: Partial<RebalancingPosition>;
      };
      grid_configs: { Row: GridConfigRow; Insert: Partial<GridConfigRow>; Update: Partial<GridConfigRow> };
    };
  };
}
