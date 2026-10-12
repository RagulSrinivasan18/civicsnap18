import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATEGORY_VALUES, MODERATION, STATUS_VALUES } from "./civic";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Administrator access required");
}

export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data };
  });

export const listAllReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAdminReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const [{ data: report }, { data: contact }, { data: history }, { data: imgs }] = await Promise.all([
      sb.from("reports").select("*").eq("id", data.id).single(),
      sb.from("report_contacts").select("name, email, phone").eq("report_id", data.id).maybeSingle(),
      sb.from("status_history").select("status, note, created_at").eq("report_id", data.id).order("created_at"),
      sb.from("report_images").select("path").eq("report_id", data.id),
    ]);
    let images: string[] = [];
    if (imgs?.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from("report-images")
        .createSignedUrls(imgs.map((i) => i.path), 3600);
      images = (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
    }
    let duplicateRef: string | null = null;
    if (report?.possible_duplicate_of) {
      const { data: d } = await sb.from("reports").select("reference").eq("id", report.possible_duplicate_of).maybeSingle();
      duplicateRef = d?.reference ?? null;
    }
    return { report, contact, history: history ?? [], images, duplicateRef };
  });

export const updateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        moderation: z.enum(MODERATION).optional(),
        status: z.enum(STATUS_VALUES).optional(),
        category: z.enum(CATEGORY_VALUES).optional(),
        authority: z.string().trim().max(150).optional(),
        resolution_notes: z.string().trim().max(2000).optional(),
        note: z.string().trim().max(500).optional(),
        forwarding: z
          .object({
            forwarded_to: z.string().trim().min(2).max(150),
            forwarding_channel: z.string().trim().min(2).max(200),
            forwarding_reference: z.string().trim().max(150).optional(),
            confirmed: z.literal(true),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.status === "forwarded" && !data.forwarding) {
      throw new Error("Record the forwarding details before marking a report as Forwarded.");
    }
    const patch: any = {};
    if (data.moderation) patch.moderation = data.moderation;
    if (data.category) patch.category = data.category;
    if (data.authority !== undefined) patch.authority = data.authority;
    if (data.resolution_notes !== undefined) patch.resolution_notes = data.resolution_notes;
    if (data.forwarding) {
      patch.forwarded_to = data.forwarding.forwarded_to;
      patch.forwarding_channel = data.forwarding.forwarding_channel;
      patch.forwarding_reference = data.forwarding.forwarding_reference || null;
      patch.forwarded_at = new Date().toISOString();
      patch.status = "forwarded";
    }
    if (data.status && !data.forwarding) patch.status = data.status;
    if (patch.status === "resolved") patch.resolved_at = new Date().toISOString();

    const { error } = await context.supabase.from("reports").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (patch.status) {
      const note = data.forwarding
        ? `Forwarded to ${data.forwarding.forwarded_to} via ${data.forwarding.forwarding_channel}${data.forwarding.forwarding_reference ? ` (ref ${data.forwarding.forwarding_reference})` : ""}.`
        : data.note || null;
      await context.supabase.from("status_history").insert({ report_id: data.id, status: patch.status as any, note });
    }

    // Sync the updated report to Google Sheets (non-blocking — failure does not block the update)
    try {
      const { syncReportUpdate } = await import("./sheet-sync.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: updatedRow } = await supabaseAdmin.from("reports").select("*").eq("id", data.id).maybeSingle();
      if (updatedRow) await syncReportUpdate(data.id, updatedRow);
    } catch (syncErr) {
      console.error("Sheet sync after admin update failed:", syncErr);
    }

    return { ok: true };
  });

export const retrySheetSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reportId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { retrySheetSync: retry } = await import("./sheet-sync.server");
    return retry(data.reportId);
  });

export const getSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reportId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { getSyncStatus: getStatus } = await import("./sheet-sync.server");
    return getStatus(data.reportId);
  });
