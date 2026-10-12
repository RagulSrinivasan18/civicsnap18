import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { MapPin, ThumbsUp, Building2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryLabel, getSupporterKey, statusLabel } from "@/lib/civic";
import { supportReport, type PublicReport } from "@/lib/reports.functions";
import { StatusBadge, DemoBadge } from "./ReportBits";
import { GoogleMap } from "./GoogleMap";

export function ReportDetail({
  report,
  history,
}: {
  report: PublicReport;
  history: { status: string; note: string | null; created_at: string }[];
}) {
  const [count, setCount] = useState(report.support_count);
  const [done, setDone] = useState(false);
  const isPublic = report.moderation === "approved";

  async function support() {
    try {
      const r = await supportReport({ data: { reportId: report.id, supporterKey: getSupporterKey() } });
      setDone(true);
      if (!r.already) setCount((c) => c + 1);
      toast.success(r.already ? "You already supported this report" : "Thanks for your support!");
    } catch (e: any) {
      toast.error(e.message ?? "Could not add support");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            <span className="text-sm font-medium text-primary">{categoryLabel(report.category)}</span>
            {report.is_demo && <DemoBadge />}
            {!isPublic && <StatusBadge status={report.moderation} />}
          </div>
          <h1 className="mt-3 text-3xl font-bold md:text-4xl">{report.title}</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">{report.reference} · reported {format(new Date(report.created_at), "d MMM yyyy, h:mm a")}</p>
        </div>

        {!isPublic && (
          <p className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
            This report is awaiting administrator review and is not yet publicly listed. Photos are shown once it is approved.
          </p>
        )}

        {report.ai_summary && (
          <div className="rounded-xl bg-accent p-4 text-sm text-accent-foreground">
            <p className="text-xs font-semibold uppercase tracking-wide">{report.ai_source === "ai" ? "AI summary" : report.ai_source === "demo" ? "Summary" : "Automatic summary (rule-based)"}</p>
            <p className="mt-1">{report.ai_summary}</p>
          </div>
        )}

        <p className="whitespace-pre-line leading-relaxed">{report.description}</p>

        {report.images.length > 0 && (
          <div>
            <h2 className="mb-3 text-xl font-semibold">Evidence</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {report.images.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt={`Evidence photo ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {report.latitude != null && report.longitude != null && (
          <div>
            <h2 className="mb-3 text-xl font-semibold">Location</h2>
            <GoogleMap points={[{ id: report.id, lat: report.latitude, lng: report.longitude, title: report.title }]} />
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><strong>{report.locality}</strong><br />{report.address}</span></p>
          {report.authority && <p className="mt-3 flex items-start gap-2 text-sm"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Responsible authority: {report.authority}</span></p>}
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm"><strong className="text-2xl">{count}</strong> supporters</span>
            {isPublic && (
              <Button onClick={support} disabled={done} variant={done ? "secondary" : "default"}>
                <ThumbsUp /> {done ? "Supported" : "I face this too"}
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-sans text-base font-semibold"><Clock className="h-4 w-4" /> Status history</h2>
          <ol className="relative space-y-4 border-l pl-5">
            {history.map((h, i) => (
              <li key={i}>
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                <p className="text-sm font-semibold">{statusLabel(h.status)}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(h.created_at), "d MMM yyyy, h:mm a")}</p>
                {h.note && <p className="mt-1 text-sm">{h.note}</p>}
              </li>
            ))}
          </ol>
          {report.resolution_notes && (
            <div className="mt-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
              <strong>Resolution notes:</strong> {report.resolution_notes}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
