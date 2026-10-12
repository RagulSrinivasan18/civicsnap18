import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Camera, Sparkles, Send, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicStats, listPublicReports } from "@/lib/reports.functions";
import { ReportCard } from "@/components/civic/ReportBits";
import hero from "@/assets/hero.jpg";

const statsQ = queryOptions({ queryKey: ["stats"], queryFn: () => getPublicStats() });
const recentQ = queryOptions({ queryKey: ["recent"], queryFn: () => listPublicReports({ data: { limit: 6 } }) });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CivicSnap — Report public problems in your community" },
      { name: "description", content: "Report potholes, garbage, broken streetlights and more. Track progress and help route complaints to the right authority." },
      { property: "og:title", content: "CivicSnap — Your Community. Your Voice. Real Change." },
      { property: "og:description", content: "Citizen reporting platform for public infrastructure problems." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(statsQ), context.queryClient.ensureQueryData(recentQ)]),
  component: Home,
});

function Home() {
  const { data: stats } = useSuspenseQuery(statsQ);
  const { data: recent } = useSuspenseQuery(recentQ);
  return (
    <>
      <section className="bg-hero">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> AI-assisted civic reporting
            </p>
            <h1 className="text-4xl font-bold leading-tight md:text-6xl">
              Your Community. Your Voice. <span className="text-primary">Real Change.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Snap a photo of a pothole, overflowing garbage or a dead streetlight. CivicSnap collects reports
              in one place, shows what's affecting your locality, and helps route each complaint to the right
              authority.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/report"><Camera /> Report a Problem</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/issues"><Search /> Explore Community Issues</Link></Button>
            </div>
          </div>
          <img src={hero} alt="Citizen photographing a pothole on a city street" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-card" width={1280} height={960} />
        </div>
      </section>

      <section className="mx-auto -mt-8 max-w-6xl px-4">
        <div className="grid gap-4 rounded-2xl border bg-card p-6 shadow-card sm:grid-cols-3">
          <Stat label="Total reports" value={stats.total} />
          <Stat label="Issues in progress" value={stats.inProgress} />
          <Stat label="Resolved reports" value={stats.resolved} />
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Live counts from citizen reports. Demo records are excluded.</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Camera, t: "1. Report", d: "Describe the problem, add a photo and pin the location." },
            { icon: Sparkles, t: "2. Classify", d: "AI suggests a category, summary and the responsible authority." },
            { icon: Send, t: "3. Forward & track", d: "An admin reviews and forwards it. Track progress by reference number." },
          ].map((s) => (
            <div key={s.t} className="rounded-xl border p-6">
              <s.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-3xl font-bold">Recently reported</h2>
          <Link to="/issues" className="text-sm font-semibold text-primary">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">No public reports yet.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => <ReportCard key={r.id} r={r} />)}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="font-display text-4xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
