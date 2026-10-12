import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { LayoutGrid, Map as MapIcon, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, CATEGORY_VALUES, STATUSES, STATUS_VALUES } from "@/lib/civic";
import { listPublicReports } from "@/lib/reports.functions";
import { ReportCard } from "@/components/civic/ReportBits";
import { GoogleMap } from "@/components/civic/GoogleMap";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  locality: z.string().optional(),
});

export const Route = createFileRoute("/issues/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Community Issues — CivicSnap" },
      { name: "description", content: "Browse, search and support public problems reported by citizens." },
      { property: "og:title", content: "Community Issues — CivicSnap" },
      { property: "og:description", content: "See public problems reported in your locality on a map." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IssuesPage,
});

function IssuesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/issues/" });
  const [view, setView] = useState<"grid" | "map">("grid");
  const [q, setQ] = useState(search.q ?? "");
  const [locality, setLocality] = useState(search.locality ?? "");

  useEffect(() => {
    const t = setTimeout(() => navigate({ search: (s) => ({ ...s, q: q || undefined, locality: locality || undefined }), replace: true }), 350);
    return () => clearTimeout(t);
  }, [q, locality, navigate]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["issues", search],
    queryFn: () => listPublicReports({ data: search }),
    placeholderData: keepPreviousData,
  });

  const points = useMemo(
    () =>
      (data ?? [])
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => ({
          id: r.id,
          lat: r.latitude!,
          lng: r.longitude!,
          title: `${r.reference} — ${r.title}`,
          onClick: () => navigate({ to: "/issues/$reference", params: { reference: r.reference } }),
        })),
    [data, navigate],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Community Issues</h1>
          <p className="mt-1 text-muted-foreground">Approved public reports. Support a report to help prioritise it.</p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          <Button size="sm" variant={view === "grid" ? "default" : "ghost"} onClick={() => setView("grid")}><LayoutGrid /> Cards</Button>
          <Button size="sm" variant={view === "map" ? "default" : "ghost"} onClick={() => setView("map")}><MapIcon /> Map</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
        <Input aria-label="Search" placeholder="Search title, address or reference" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        <Input aria-label="Locality" placeholder="Locality" value={locality} onChange={(e) => setLocality(e.target.value)} maxLength={100} />
        <Select value={search.category ?? "all"} onValueChange={(v) => navigate({ search: (s) => ({ ...s, category: v === "all" ? undefined : (v as any) }) })}>
          <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={search.status ?? "all"} onValueChange={(v) => navigate({ search: (s) => ({ ...s, status: v === "all" ? undefined : (v as any) }) })}>
          <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" /> Loading reports…</p>
        ) : isError ? (
          <p className="text-destructive">Could not load reports: {(error as Error).message}</p>
        ) : !data?.length ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">No reports match your filters.</p>
        ) : view === "grid" ? (
          <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${isFetching ? "opacity-60" : ""}`}>
            {data.map((r) => <ReportCard key={r.id} r={r} />)}
          </div>
        ) : (
          <>
            <GoogleMap points={points} className="h-[560px]" />
            <p className="mt-2 text-xs text-muted-foreground">{points.length} of {data.length} reports have a pinned location. Click a marker to open it.</p>
          </>
        )}
      </div>
    </div>
  );
}
