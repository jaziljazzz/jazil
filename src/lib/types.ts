export type Role = "founder" | "agent";
export type Source = "bought" | "meta" | "instagram";
export type Stage = "new" | "contacted" | "shortlisting" | "meeting" | "negotiation" | "won" | "lost";
export type CallOutcome = "connected" | "not_answered" | "busy" | "switched_off" | "wrong_number";
export type MeetingType = "site_visit" | "sales_office" | "video_call" | "office";
export type MeetingStatus = "scheduled" | "done" | "no_show";
export type Feedback = "pending" | "liked" | "maybe" | "rejected";

export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  active: boolean;
  on_leave: boolean;
  round_robin_order: number;
}

export interface Settings {
  id: number;
  company_name: string;
  timezone: string;
  sla_minutes: number;
  reassign_hours: number;
  max_attempts: number;
  attempt_window_days: number;
  stale_days: number;
  recycle_days: number;
  future_buyer_days: number;
  lost_reasons: string[];
  reject_reasons: string[];
  cadence_days: number[];
  wa_templates?: { title: string; body: string }[];
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  nationality: string | null;
  is_nri: boolean;
  preferred_language?: string | null;
  source: Source;
  batch_id: string | null;
  campaign: string | null;
  ad_name: string | null;
  owner_id: string | null;
  stage: Stage;
  lost_reason: string | null;
  lost_at: string | null;
  selected_project: string | null;
  selected_unit: string | null;
  next_followup_at: string | null;
  assigned_at: string;
  last_activity_at: string;
  first_called_at: string | null;
  attempt_count: number;
  sla_breached: boolean;
  is_stale: boolean;
  in_recycle_pool: boolean;
  needs_founder_attention: boolean;
  created_at: string;
  requirements?: Requirement | Requirement[] | null;
  owner?: { name: string } | null;
}

export interface Requirement {
  id?: string;
  lead_id: string;
  budget_min: number | null;
  budget_max: number | null;
  area: string | null;
  bedrooms: string | null;
  ready_or_offplan: "ready" | "offplan" | "either" | null;
  handover_year: number | null;
  payment_plan: string | null;
  purpose: "end_use" | "investment" | null;
  property_type?: string | null;
  notes: string | null;
}

export interface ShortlistedUnit {
  id: string;
  lead_id: string;
  project: string;
  developer_id: string | null;
  unit_type: string | null;
  price: number | null;
  feedback: Feedback;
  reject_reason: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  user_id: string | null;
  type: "call" | "note" | "stage_change" | "meeting" | "reassignment" | "whatsapp" | "followup" | "system" | "duplicate" | "deal";
  call_outcome: CallOutcome | null;
  note: string | null;
  from_stage: Stage | null;
  to_stage: Stage | null;
  next_followup_at: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  user?: { name: string } | null;
}

export interface Meeting {
  id: string;
  lead_id: string;
  user_id: string | null;
  type: MeetingType;
  scheduled_at: string;
  location: string | null;
  status: MeetingStatus;
  feedback: string | null;
}

export interface Developer {
  id: string;
  name: string;
  default_commission_pct: number;
  contact_name: string | null;
  contact_phone: string | null;
}

export interface Deal {
  id: string;
  lead_id: string;
  developer_id: string | null;
  project: string;
  unit: string | null;
  sale_value: number;
  commission_pct: number;
  commission_amount: number;
  agent_id: string | null;
  split_agent_id: string | null;
  split_pct: number;
  booked_via: string;
  booking_date: string;
  expected_commission_date: string | null;
  commission_status: "pending" | "received";
  received_date: string | null;
  received_amount: number | null;
  cancelled: boolean;
  documents: { name: string; url: string }[];
  lead?: { name: string; phone: string } | null;
  developer?: { name: string } | null;
  agent?: { name: string } | null;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  lead_id: string | null;
  deal_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AgentMetrics {
  agent_id: string;
  agent_name: string;
  on_leave: boolean;
  leads_assigned: number;
  contacted: number;
  calls: number;
  calls_connected: number;
  followups_due: number;
  followups_done: number;
  overdue: number;
  untouched: number;
  st_new: number;
  st_contacted: number;
  st_shortlisting: number;
  st_meeting: number;
  st_negotiation: number;
  st_won: number;
  st_lost: number;
  meetings_scheduled: number;
  meetings_done: number;
  units_sold: number;
  sale_value: number;
  commission_earned: number;
  commission_received: number;
  avg_first_response_minutes: number | null;
  calls_dialed: number;
  call_seconds: number;
}
