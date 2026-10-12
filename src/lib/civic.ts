export const CATEGORIES = [
  { value: "pothole", label: "Pothole / Road Damage" },
  { value: "garbage", label: "Garbage" },
  { value: "streetlight", label: "Streetlight" },
  { value: "water", label: "Water / Drainage" },
  { value: "public_safety", label: "Public Safety" },
  { value: "other", label: "Other" },
] as const;
export type Category = (typeof CATEGORIES)[number]["value"];
export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [Category, ...Category[]];

export const STATUSES = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "forwarded", label: "Forwarded" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
] as const;
export type Status = (typeof STATUSES)[number]["value"];
export const STATUS_VALUES = STATUSES.map((s) => s.value) as [Status, ...Status[]];

export const MODERATION = ["pending", "approved", "rejected", "flagged"] as const;
export type Moderation = (typeof MODERATION)[number];

export const AUTHORITIES = [
  "Municipal Corporation – Roads",
  "Road Maintenance Authority",
  "Municipal Corporation – Solid Waste Management",
  "Gram Panchayat",
  "Electricity Distribution Company",
  "Water Supply & Sewerage Board",
  "Local Police Station",
  "Municipal Corporation – General Grievances",
] as const;

export const categoryLabel = (v?: string | null) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? "Other";
export const statusLabel = (v?: string | null) =>
  STATUSES.find((s) => s.value === v)?.label ?? v ?? "";

export function getSupporterKey() {
  if (typeof window === "undefined") return "";
  let k = localStorage.getItem("civicsnap_supporter");
  if (!k) {
    k = crypto.randomUUID();
    localStorage.setItem("civicsnap_supporter", k);
  }
  return k;
}
