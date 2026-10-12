import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { categoryLabel, statusLabel } from "./civic";

// Maps a report row from the database to the Google Sheet column order:
// Report ID, Date Reported, Problem Title, Problem Description, Category,
// Place, Locality, Address, Latitude, Longitude, Status, Assigned Authority,
// Forwarded Date, Resolution Notes, Last Updated
function reportToSheetRow(r: Record<string, any>): string[] {
  return [
    r.reference ?? "",
    r.created_at ? new Date(r.created_at).toISOString() : "",
    r.title ?? "",
    r.description ?? "",
    categoryLabel(r.category),
    r.locality ?? "",
    r.address ?? "",
    r.latitude != null ? String(r.latitude) : "",
    r.longitude != null ? String(r.longitude) : "",
    statusLabel(r.status),
    r.authority ?? "",
    r.forwarded_at ? new Date(r.forwarded_at).toISOString() : "",
    r.resolution_notes ?? "",
    r.updated_at ? new Date(r.updated_at).toISOString() : "",
  ];
}

async function callSheetSync(operation: "insert" | "update", reportId: string, rowData: string[]) {
  const functionUrl = `${process.env["SUPABASE_URL"]}/functions/v1/google-sheet-sync`;
  const resp = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env["SUPABASE_SERVICE_ROLE_KEY"]}`,
    },
    body: JSON.stringify({ operation, reportId, rowData }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sheet sync failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function syncReportInsert(reportId: string, reportRow: Record<string, any>) {
  const db = supabaseAdmin;
  const rowData = reportToSheetRow(reportRow);

  await db.from("sheet_sync_log").insert({
    report_id: reportId,
    sync_type: "insert",
    status: "pending",
  });

  try {
    const result = await callSheetSync("insert", reportRow.reference, rowData);
    await db.from("sheet_sync_log").update({
      status: "synced",
      sheet_row_url: result.rowNumber ? `row ${result.rowNumber}` : null,
      synced_at: new Date().toISOString(),
      last_attempted_at: new Date().toISOString(),
    }).eq("report_id", reportId).eq("sync_type", "insert").order("created_at", { ascending: false }).limit(1);
    return { synced: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await db.from("sheet_sync_log").update({
      status: "failed",
      error_message: message,
      last_attempted_at: new Date().toISOString(),
    }).eq("report_id", reportId).eq("sync_type", "insert").order("created_at", { ascending: false }).limit(1);
    console.error(`Sheet sync failed for report ${reportId}:`, message);
    return { synced: false, error: message };
  }
}

export async function syncReportUpdate(reportId: string, reportRow: Record<string, any>) {
  const db = supabaseAdmin;
  const rowData = reportToSheetRow(reportRow);

  await db.from("sheet_sync_log").insert({
    report_id: reportId,
    sync_type: "update",
    status: "pending",
  });

  try {
    const result = await callSheetSync("update", reportRow.reference, rowData);
    await db.from("sheet_sync_log").update({
      status: "synced",
      synced_at: new Date().toISOString(),
      last_attempted_at: new Date().toISOString(),
    }).eq("report_id", reportId).eq("sync_type", "update").order("created_at", { ascending: false }).limit(1);
    return { synced: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await db.from("sheet_sync_log").update({
      status: "failed",
      error_message: message,
      last_attempted_at: new Date().toISOString(),
    }).eq("report_id", reportId).eq("sync_type", "update").order("created_at", { ascending: false }).limit(1);
    console.error(`Sheet update sync failed for report ${reportId}:`, message);
    return { synced: false, error: message };
  }
}

export async function retrySheetSync(reportId: string) {
  const db = supabaseAdmin;
  const { data: report } = await db.from("reports").select("*").eq("id", reportId).maybeSingle();
  if (!report) throw new Error("Report not found");

  const { data: log } = await db.from("sheet_sync_log")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const operation = log?.sync_type ?? "insert";
  const rowData = reportToSheetRow(report);

  await db.from("sheet_sync_log").update({
    status: "pending",
    attempts: (log?.attempts ?? 0) + 1,
    last_attempted_at: new Date().toISOString(),
  }).eq("id", log!.id);

  try {
    const result = await callSheetSync(operation as "insert" | "update", report.reference, rowData);
    await db.from("sheet_sync_log").update({
      status: "synced",
      synced_at: new Date().toISOString(),
      last_attempted_at: new Date().toISOString(),
    }).eq("id", log!.id);
    return { synced: true, action: result.action };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await db.from("sheet_sync_log").update({
      status: "failed",
      error_message: message,
      last_attempted_at: new Date().toISOString(),
    }).eq("id", log!.id);
    return { synced: false, error: message };
  }
}

export async function getSyncStatus(reportId: string) {
  const db = supabaseAdmin;
  const { data } = await db.from("sheet_sync_log")
    .select("sync_type, status, error_message, attempts, last_attempted_at, synced_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}
