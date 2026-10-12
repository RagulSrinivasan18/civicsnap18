import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CircleCheck as CheckCircle2, Loader as Loader2, Upload, X, TriangleAlert as AlertTriangle, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, CATEGORY_VALUES, categoryLabel, getSupporterKey, statusLabel } from "@/lib/civic";
import { findDuplicates, submitReport, supportReport } from "@/lib/reports.functions";
import { GoogleMap } from "@/components/civic/GoogleMap";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a Problem — CivicSnap" },
      { name: "description", content: "Report a pothole, garbage, streetlight, water or safety problem in your locality." },
      { property: "og:title", content: "Report a Problem — CivicSnap" },
      { property: "og:description", content: "Submit a public problem with photos and location." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});

const schema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(150),
  description: z.string().trim().min(20, "Please describe the problem in at least 20 characters").max(2000),
  category: z.enum(CATEGORY_VALUES, { errorMap: () => ({ message: "Choose a category" }) }),
  locality: z.string().trim().min(2, "Locality is required").max(100),
  address: z.string().trim().min(5, "Address or landmark is required").max(300),
  contactEmail: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  contactPhone: z.string().trim().regex(/^[0-9+\-\s]{0,20}$/, "Invalid phone number").optional(),
});

type Dup = Awaited<ReturnType<typeof findDuplicates>>[number];
type Result = Awaited<ReturnType<typeof submitReport>>;

const toBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(f);
  });

function ReportPage() {
  const [form, setForm] = useState({ title: "", description: "", category: "", locality: "", address: "", contactName: "", contactEmail: "", contactPhone: "" });
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [dups, setDups] = useState<Dup[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [supported, setSupported] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!form.category || form.locality.trim().length < 2) return setDups([]);
    const t = setTimeout(() => {
      findDuplicates({ data: { title: form.title, category: form.category as any, locality: form.locality } })
        .then(setDups)
        .catch(() => setDups([]));
    }, 500);
    return () => clearTimeout(t);
  }, [form.category, form.locality, form.title]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        toast.error(`${f.name}: only JPG, PNG or WEBP images are allowed`);
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} is larger than 5 MB`);
        continue;
      }
      if (next.length >= 3) {
        toast.error("You can attach up to 3 photos");
        break;
      }
      next.push(f);
    }
    setFiles(next);
  }

  async function onSupport(d: Dup) {
    try {
      const r = await supportReport({ data: { reportId: d.id, supporterKey: getSupporterKey() } });
      setSupported(d.reference);
      toast.success(r.already ? "You already supported this report" : "Thanks! Your support was added.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not add support");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const images = await Promise.all(files.map(async (f) => ({ name: f.name, type: f.type as any, base64: await toBase64(f) })));
      const res = await submitReport({
        data: {
          ...parsed.data,
          contactName: form.contactName || undefined,
          latitude: loc?.lat ?? null,
          longitude: loc?.lng ?? null,
          images,
        },
      });
      setResult(res);
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      toast.error(e.message ?? "Submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h1 className="mt-4 text-3xl font-bold">Report submitted</h1>
          <p className="mt-2 text-muted-foreground">Save your reference number to track progress.</p>
          <p className="mt-6 rounded-lg bg-accent px-4 py-3 font-mono text-2xl font-bold text-accent-foreground">{result.reference}</p>
          <div className="mt-6 space-y-2 rounded-lg border p-4 text-left text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {result.ai.source === "ai" ? "AI analysis" : "Automatic analysis (rule-based fallback)"} — reviewed by an admin
            </p>
            <p><strong>Suggested category:</strong> {categoryLabel(result.ai.category)}</p>
            <p><strong>Summary:</strong> {result.ai.summary}</p>
            <p><strong>Suggested authority:</strong> {result.ai.authority}</p>
            {result.possibleDuplicate && (
              <p className="text-foreground"><AlertTriangle className="mr-1 inline h-4 w-4 text-warning" />Looks similar to an existing report — flagged for review.</p>
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Your report will appear publicly after an administrator approves it. It has <strong>not</strong> yet been sent to any authority.
          </p>
          {result.sheetSynced ? (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Recorded in Google Sheets.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Could not sync to Google Sheets right now. Your report is saved — an admin can retry the sync later.
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild><Link to="/track" search={{ ref: result.reference }}>Track this report</Link></Button>
            <Button variant="outline" onClick={() => { setResult(null); setForm({ title: "", description: "", category: "", locality: "", address: "", contactName: "", contactEmail: "", contactPhone: "" }); setFiles([]); setLoc(null); }}>
              Report another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-bold">Report a Problem</h1>
      <p className="mt-2 text-muted-foreground">Fields marked * are required.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6" noValidate>
        <Field label="Issue title *" error={errors["title"]} id="title">
          <Input id="title" value={form.title} onChange={(e) => set("title")(e.target.value)} placeholder="e.g. Large pothole near bus stop" maxLength={150} />
        </Field>
        <Field label="Detailed description *" error={errors["description"]} id="description">
          <Textarea id="description" rows={5} value={form.description} onChange={(e) => set("description")(e.target.value)} placeholder="What is the problem, how long has it been there, who is affected?" maxLength={2000} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Category *" error={errors["category"]} id="category">
            <Select value={form.category} onValueChange={set("category")}>
              <SelectTrigger id="category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Locality *" error={errors["locality"]} id="locality">
            <Input id="locality" value={form.locality} onChange={(e) => set("locality")(e.target.value)} placeholder="e.g. Anna Nagar" maxLength={100} />
          </Field>
        </div>

        {dups.length > 0 && (
          <div className="rounded-xl border border-warning/50 bg-warning/10 p-4">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Similar reports already exist nearby</p>
            <p className="text-sm text-muted-foreground">If it's the same problem, support the existing report instead of creating a new one.</p>
            <ul className="mt-3 space-y-2">
              {dups.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-3 text-sm">
                  <span>
                    <Link to="/issues/$reference" params={{ reference: d.reference }} className="font-medium hover:text-primary">{d.title}</Link>
                    <span className="block text-xs text-muted-foreground">{d.reference} · {d.locality} · {statusLabel(d.status)} · {d.support_count} supporters</span>
                  </span>
                  <Button type="button" size="sm" variant="outline" disabled={supported === d.reference} onClick={() => onSupport(d)}>
                    <ThumbsUp /> {supported === d.reference ? "Supported" : "Support this"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Field label="Address / landmark *" error={errors["address"]} id="address">
          <Input id="address" value={form.address} onChange={(e) => set("address")(e.target.value)} placeholder="Street, landmark" maxLength={300} />
        </Field>

        <div>
          <Label>Map location (optional)</Label>
          <p className="mb-2 text-xs text-muted-foreground">Click on the map to drop a pin.</p>
          <GoogleMap picked={loc} onPick={setLoc} />
          {loc && (
            <p className="mt-2 text-xs text-muted-foreground">
              Pinned: {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}{" "}
              <button type="button" className="text-primary underline" onClick={() => setLoc(null)}>clear</button>
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="photos">Photos (optional, up to 3, max 5 MB each)</Label>
          <label htmlFor="photos" className="mt-2 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-muted">
            <Upload className="h-6 w-6" /> Choose JPG, PNG or WEBP images
          </label>
          <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} alt={f.name} className="h-24 w-24 rounded-lg object-cover" />
                  <button type="button" aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <fieldset className="rounded-xl border p-4">
          <legend className="px-1 text-sm font-semibold">Contact (optional, kept private)</legend>
          <p className="mb-3 text-xs text-muted-foreground">Only administrators can see this. It is never shown publicly.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input aria-label="Name" placeholder="Name" value={form.contactName} onChange={(e) => set("contactName")(e.target.value)} maxLength={100} />
            <div>
              <Input aria-label="Email" placeholder="Email" type="email" value={form.contactEmail} onChange={(e) => set("contactEmail")(e.target.value)} maxLength={255} />
              {errors["contactEmail"] && <p className="mt-1 text-xs text-destructive">{errors["contactEmail"]}</p>}
            </div>
            <div>
              <Input aria-label="Phone" placeholder="Phone" value={form.contactPhone} onChange={(e) => set("contactPhone")(e.target.value)} maxLength={20} />
              {errors["contactPhone"] && <p className="mt-1 text-xs text-destructive">{errors["contactPhone"]}</p>}
            </div>
          </div>
        </fieldset>

        <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">
          {busy ? <><Loader2 className="animate-spin" /> Submitting & analysing…</> : "Submit report"}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, error, id, children }: { label: string; error?: string | undefined; id: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
