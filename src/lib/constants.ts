import type { CallOutcome, MeetingType, Source, Stage } from "./types";

export const STAGES: Stage[] = ["new", "contacted", "shortlisting", "meeting", "negotiation", "won", "lost"];
export const OPEN_STAGES: Stage[] = ["new", "contacted", "shortlisting", "meeting", "negotiation"];

export const STAGE_META: Record<Stage, { label: string; color: string; bg: string; next?: string }> = {
  new: { label: "New", color: "#2563EB", bg: "#EFF6FF", next: "Call the client" },
  contacted: { label: "Contacted", color: "#0E7490", bg: "#ECFEFF", next: "Requirement card + follow up" },
  shortlisting: { label: "Shortlisting", color: "#7C3AED", bg: "#F5F3FF", next: "Shortlisted unit + follow up" },
  meeting: { label: "Meeting", color: "#C026D3", bg: "#FDF4FF", next: "Meeting type, date and time" },
  negotiation: { label: "Negotiation", color: "#EA580C", bg: "#FFF7ED", next: "Selected project and unit + follow up" },
  won: { label: "Won", color: "#16A34A", bg: "#F0FDF4", next: "Deal details" },
  lost: { label: "Lost", color: "#DC2626", bg: "#FEF2F2", next: "Lost reason" },
};

export const SOURCE_META: Record<Source, { label: string; short: string }> = {
  bought: { label: "Bought list", short: "Bought" },
  meta: { label: "Meta ads", short: "Meta" },
  instagram: { label: "Instagram (Self)", short: "Instagram" },
};

export const OUTCOMES: { value: CallOutcome; label: string; tone: "success" | "warning" | "danger" | "muted" }[] = [
  { value: "connected", label: "Connected", tone: "success" },
  { value: "not_answered", label: "Not answered", tone: "warning" },
  { value: "busy", label: "Busy", tone: "warning" },
  { value: "switched_off", label: "Switched off", tone: "muted" },
  { value: "wrong_number", label: "Wrong number", tone: "danger" },
];
export const OUTCOME_LABEL: Record<CallOutcome, string> = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label])) as Record<CallOutcome, string>;

export const MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: "site_visit", label: "Site visit" },
  { value: "sales_office", label: "Sales office" },
  { value: "video_call", label: "Video call" },
  { value: "office", label: "Office meeting" },
];
export const MEETING_LABEL: Record<MeetingType, string> = Object.fromEntries(MEETING_TYPES.map((m) => [m.value, m.label])) as Record<MeetingType, string>;

export const BEDROOMS = ["Studio", "1", "2", "3", "4", "5+"];
export const PAYMENT_PLANS = ["Cash", "Mortgage", "Post handover plan", "Developer payment plan"];
