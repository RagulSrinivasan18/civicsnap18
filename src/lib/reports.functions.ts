import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CATEGORY_VALUES, STATUS_VALUES } from "./civic";

const PUBLIC_COLS =
  "id, reference, title, description, category, locality, address, latitude, longitude, status, moderation, authority, ai_summary, ai_source, support_count, forwarded_at, resolution_notes, resolved_at, is_demo, created_at, updated_at";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type PublicReport = {
  id: string;
  reference: string;
  title: string;
  description: string;
  category: string;
  locality: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  moderation: string;
  authority: string | null;
  ai_summary: string | null;
  ai_source: string | null;
  support_count: number;
  forwarded_at: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  images: string[];
};

async function withImages(db: Awaited<ReturnType<typeof admin>>, rows: any[]): Promise<PublicReport[]> {
  if (!rows.length) return [];
  const { data: imgs } = await db
    .from("report_images")
    .select("report_id, path")
    .in("report_id", rows.map((r) => r.id));
  const paths = (imgs ?? []).map((i) => i.path);
  const urlMap = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await db.storage.from("report-images").createSignedUrls(paths, 60 * 60);
    signed?.forEach((s) => s.path && s.signedUrl && urlMap.set(s.path, s.signedUrl));
  }
  return rows.map((r) => ({
    ...r,
    images: (imgs ?? []).filter((i) => i.report_id === r.id).map((i) => urlMap.get(i.path)).filter(Boolean) as string[],
  }));
}

export const getPublicStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const count = async (f?: (q: any) => any) => {
    let q = db.from("reports").select("id", { count: "exact", head: true }).eq("is_demo", false).neq("moderation", "rejected");
    if (f) q = f(q);
    const { count } = await q;
    return count ?? 0;
  };
  const [total, inProgress, resolved] = await Promise.all([
    count(),
    count((q) => q.in("status", ["under_review", "forwarded", "in_progress"])),
    count((q) => q.eq("status", "resolved")),
  ]);
  return { total, inProgress, resolved };
});

const listSchema = z.object({
  q: z.string().max(100).optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  locality: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const listPublicReports = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => listSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const db = await admin();
    let q = db.from("reports").select(PUBLIC_COLS).eq("moderation", "approved").order("created_at", { ascending: false }).limit(data.limit ?? 60);
    if (data.category) q = q.eq("category", data.category);
    if (data.status) q = q.eq("status", data.status);
    if (data.locality) q = q.ilike("locality", `%${data.locality.replace(/[%_,()]/g, "")}%`);
    if (data.q) {
      const s = data.q.replace(/[%_,()]/g, "");
      q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%,reference.ilike.%${s}%,address.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return withImages(db, rows ?? []);
  });

export const getReportByReference = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ reference: z.string().trim().min(3).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db.from("reports").select(PUBLIC_COLS).ilike("reference", data.reference).maybeSingle();
    if (!row || row.moderation === "rejected") return null;
    const { data: history } = await db
      .from("status_history")
      .select("status, note, created_at")
      .eq("report_id", row.id)
      .order("created_at", { ascending: true });
    // Pending/flagged reports are trackable by reference, but evidence is shown only once approved.
    const [report] = row.moderation === "approved" ? await withImages(db, [row]) : [{ ...row, images: [] }];
    return { report: report as PublicReport, history: history ?? [] };
  });

export const findDuplicates = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ title: z.string().max(150), category: z.enum(CATEGORY_VALUES), locality: z.string().max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.locality.trim().length < 2) return [];
    const db = await admin();
    const { data: rows } = await db
      .from("reports")
      .select("id, reference, title, locality, address, status, support_count, created_at")
      .eq("moderation", "approved")
      .eq("category", data.category)
      .ilike("locality", `%${data.locality.trim().replace(/[%_,()]/g, "")}%`)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(20);
    const words = new Set(data.title.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    return (rows ?? [])
      .map((r) => {
        const rw = r.title.toLowerCase().split(/\W+/);
        const overlap = rw.filter((w) => words.has(w)).length;
        return { ...r, score: overlap + 1 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  });

const imageSchema = z.object({
  name: z.string().max(200),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().max(7_000_000),
});

const submitSchema = z.object({
  title: z.string().trim().min(5).max(150),
  description: z.string().trim().min(20).max(2000),
  category: z.enum(CATEGORY_VALUES),
  locality: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(300),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  contactName: z.string().trim().max(100).optional(),
  contactEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
  contactPhone: z.string().trim().regex(/^[0-9+\-\s]{0,20}$/).optional(),
  images: z.array(imageSchema).max(3),
});

function makeReference() {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => chars[b % chars.length]).join("");
  return `CS-${ymd}-${rnd}`;
}

export const submitReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { analyze } = await import("./ai.server");
    const ai = await analyze(data.title, data.description, data.locality);

    // Duplicate check against approved, open reports in the same category + locality.
    const { data: dupes } = await db
      .from("reports")
      .select("id, title")
      .eq("moderation", "approved")
      .eq("category", data.category)
      .ilike("locality", data.locality.replace(/[%_,()]/g, ""))
      .neq("status", "resolved")
      .limit(20);
    const words = new Set(data.title.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const dup = (dupes ?? []).find((r) => r.title.toLowerCase().split(/\W+/).filter((w) => words.has(w)).length >= 2);

    let reference = makeReference();
    let inserted: { id: string; reference: string } | null = null;
    for (let i = 0; i < 3 && !inserted; i++) {
      const { data: row, error } = await db
        .from("reports")
        .insert({
          reference,
          title: data.title,
          description: data.description,
          category: data.category,
          locality: data.locality,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          ai_category: ai.category,
          ai_summary: ai.summary,
          ai_authority: ai.authority,
          ai_source: ai.source,
          authority: ai.authority,
          possible_duplicate_of: dup?.id ?? null,
        })
        .select("id, reference")
        .single();
      if (error?.code === "23505") reference = makeReference();
      else if (error) throw new Error(error.message);
      else inserted = row;
    }
    if (!inserted) throw new Error("Could not generate a reference number. Please try again.");

    await db.from("status_history").insert({ report_id: inserted.id, status: "submitted", note: "Report received by CivicSnap." });

    if (data.contactName || data.contactEmail || data.contactPhone) {
      await db.from("report_contacts").insert({
        report_id: inserted.id,
        name: data.contactName || null,
        email: data.contactEmail || null,
        phone: data.contactPhone || null,
      });
    }

    for (const img of data.images) {
      const bytes = Uint8Array.from(atob(img.base64), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 5 * 1024 * 1024) continue;
      // Verify magic bytes so non-images can't be uploaded with a fake type.
      const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45;
      if (!isJpg && !isPng && !isWebp) continue;
      const ext = img.type.split("/")[1];
      const path = `${inserted.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from("report-images").upload(path, bytes, { contentType: img.type });
      if (!error) await db.from("report_images").insert({ report_id: inserted.id, path });
    }

    return {
      reference: inserted.reference,
      ai: { category: ai.category, summary: ai.summary, authority: ai.authority, source: ai.source },
      possibleDuplicate: !!dup,
    };
  });

export const supportReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ reportId: z.string().uuid(), supporterKey: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: r } = await db.from("reports").select("id, moderation").eq("id", data.reportId).maybeSingle();
    if (!r || r.moderation !== "approved") throw new Error("Report not available");
    const { error } = await db.from("report_supports").insert({ report_id: data.reportId, supporter_key: data.supporterKey });
    if (error?.code === "23505") return { ok: true, already: true };
    if (error) throw new Error(error.message);
    return { ok: true, already: false };
  });
