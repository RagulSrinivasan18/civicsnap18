import { Link } from "@tanstack/react-router";
import { MapPin, Calendar, ThumbsUp, ImageOff } from "lucide-react";
import { format } from "date-fns";
import { cva } from "class-variance-authority";
import { categoryLabel, statusLabel } from "@/lib/civic";
import type { PublicReport } from "@/lib/reports.functions";

const statusStyles = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    status: {
      submitted: "bg-secondary text-secondary-foreground",
      under_review: "bg-warning/15 text-foreground",
      forwarded: "bg-info/15 text-info",
      in_progress: "bg-chart-2/10 text-foreground",
      resolved: "bg-accent text-accent-foreground",
      pending: "bg-warning/15 text-foreground",
      approved: "bg-accent text-accent-foreground",
      rejected: "bg-destructive/10 text-destructive",
      flagged: "bg-destructive/10 text-destructive",
    },
  },
});

export function StatusBadge({ status }: { status: string }) {
  const label = ["pending", "approved", "rejected", "flagged"].includes(status)
    ? status[0].toUpperCase() + status.slice(1)
    : statusLabel(status);
  return <span className={statusStyles({ status: status as any })}>{label}</span>;
}

export function DemoBadge() {
  return <span className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">Demo</span>;
}

export function ReportCard({ r }: { r: PublicReport }) {
  return (
    <Link
      to="/issues/$reference"
      params={{ reference: r.reference }}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition hover:-translate-y-0.5"
    >
      <div className="aspect-[16/9] bg-muted">
        {r.images[0] ? (
          <img src={r.images[0]} alt={r.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={r.status} />
          <span className="text-xs font-medium text-primary">{categoryLabel(r.category)}</span>
          {r.is_demo && <DemoBadge />}
        </div>
        <h3 className="font-sans text-base font-semibold leading-snug group-hover:text-primary">{r.title}</h3>
        <div className="mt-auto space-y-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{r.locality}</p>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(new Date(r.created_at), "d MMM yyyy")}</span>
            <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{r.support_count}</span>
          </div>
          <p className="font-mono">{r.reference}</p>
        </div>
      </div>
    </Link>
  );
}
