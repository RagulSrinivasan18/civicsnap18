import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getReportByReference } from "@/lib/reports.functions";
import { ReportDetail } from "@/components/civic/ReportDetail";

const reportQ = (reference: string) =>
  queryOptions({ queryKey: ["report", reference], queryFn: () => getReportByReference({ data: { reference } }) });

export const Route = createFileRoute("/issues/$reference")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(reportQ(params.reference));
    if (!d) throw notFound();
    return { title: d.report.title, summary: d.report.ai_summary ?? d.report.description.slice(0, 150) };
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: `${loaderData?.title ?? params.reference} — CivicSnap` },
      { name: "description", content: loaderData?.summary ?? "Public problem report on CivicSnap." },
      { property: "og:title", content: `${loaderData?.title ?? params.reference} — CivicSnap` },
      { property: "og:description", content: loaderData?.summary ?? "Public problem report on CivicSnap." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">Report not found</h1>
      <p className="mt-2 text-muted-foreground">Check the reference number and try again.</p>
      <Link to="/track" className="mt-6 inline-block font-semibold text-primary">Track a report →</Link>
    </div>
  ),
  component: Page,
});

function Page() {
  const { reference } = Route.useParams();
  const { data } = useSuspenseQuery(reportQ(reference));
  if (!data) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link to="/issues" className="text-sm font-semibold text-primary">← All issues</Link>
      <div className="mt-6"><ReportDetail report={data.report} history={data.history} /></div>
    </div>
  );
}
