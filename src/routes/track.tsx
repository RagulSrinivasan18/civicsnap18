import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getReportByReference } from "@/lib/reports.functions";
import { ReportDetail } from "@/components/civic/ReportDetail";

export const Route = createFileRoute("/track")({
  validateSearch: (s) => z.object({ ref: z.string().max(40).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Track a Report — CivicSnap" },
      { name: "description", content: "Track the progress of your complaint with its reference number." },
      { property: "og:title", content: "Track a Report — CivicSnap" },
      { property: "og:description", content: "Check the status of a CivicSnap report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate({ from: "/track" });
  const [value, setValue] = useState(ref ?? "");
  const { data, isFetching, isError } = useQuery({
    queryKey: ["track", ref],
    queryFn: () => getReportByReference({ data: { reference: ref! } }),
    enabled: !!ref && ref.length >= 3,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-bold">Track a Report</h1>
      <form
        className="mt-6 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: { ref: value.trim() || undefined } });
        }}
      >
        <Input aria-label="Reference number" placeholder="e.g. CS-261012-ABCDE" value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} className="font-mono" />
        <Button type="submit"><Search /> Track</Button>
      </form>
      <div className="mt-10">
        {isFetching ? (
          <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" /> Looking up…</p>
        ) : isError ? (
          <p className="text-destructive">Something went wrong. Please try again.</p>
        ) : ref && data === null ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No report found with reference <span className="font-mono">{ref}</span>.</p>
        ) : data ? (
          <ReportDetail report={data.report} history={data.history} />
        ) : null}
      </div>
    </div>
  );
}
