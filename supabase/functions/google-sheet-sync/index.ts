import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const body = await req.json();
      const { operation, reportId, rowData } = body;

      if (!operation || !reportId || !rowData) {
        return new Response(JSON.stringify({ error: "Missing required fields: operation, reportId, rowData" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await syncToSheet(operation, reportId, rowData);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown sync error";
      console.error("Sheet sync error:", message);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  });
}

// ─── Google Sheets sync logic ───────────────────────────────────────────────

const SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID");
const SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const PRIVATE_KEY = Deno.env.get("GOOGLE_PRIVATE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SHEET_NAME = "Reports";
const COLUMN_COUNT = 15; // Report ID through Last Updated
const HEADER_RANGE = `${SHEET_NAME}!A1:O1`;
const DATA_RANGE = `${SHEET_NAME}!A2:O`;

type Operation = "insert" | "update";

type SyncResult = { ok: boolean; action: "inserted" | "updated"; rowNumber?: number };

async function syncToSheet(operation: Operation, reportId: string, rowData: string[]): Promise<SyncResult> {
  if (!SHEET_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
    throw new Error("Google Sheets credentials are not configured. Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY as edge function secrets.");
  }

  const token = await getGoogleServiceToken();

  if (operation === "insert") {
    return await insertRow(token, reportId, rowData);
  } else {
    return await updateRow(token, reportId, rowData);
  }
}

async function insertRow(token: string, reportId: string, rowData: string[]): Promise<SyncResult> {
  // Check if a row with this Report ID already exists (idempotency — prevents duplicates on retry)
  const existingRow = await findRowByReportId(token, reportId);
  if (existingRow !== -1) {
    // Row already exists — update it instead of appending a duplicate
    await updateRowValues(token, existingRow, rowData);
    return { ok: true, action: "updated", rowNumber: existingRow };
  }

  // Append a new row at the end of the sheet
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A:O:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [rowData] }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Sheets append failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const rowNumber = data?.updates?.updatedRange
    ? parseInt(data.updates.updatedRange.match(/A(\d+):/)?.[1] ?? "0", 10)
    : undefined;

  return { ok: true, action: "inserted", rowNumber };
}

async function updateRow(token: string, reportId: string, rowData: string[]): Promise<SyncResult> {
  const rowNumber = await findRowByReportId(token, reportId);
  if (rowNumber === -1) {
    // Row doesn't exist in the sheet yet — insert it instead
    return await insertRow(token, reportId, rowData);
  }

  await updateRowValues(token, rowNumber, rowData);
  return { ok: true, action: "updated", rowNumber };
}

async function updateRowValues(token: string, rowNumber: number, rowData: string[]): Promise<void> {
  const range = `${SHEET_NAME}!A${rowNumber}:O${rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [rowData] }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Sheets update failed (${resp.status}): ${text}`);
  }
}

async function findRowByReportId(token: string, reportId: string): Promise<number> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${DATA_RANGE}`;
  const resp = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Sheets read failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const rows: string[][] = data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.[0] === reportId) {
      return i + 2; // +2 because data starts at row 2 (row 1 is header) and arrays are 0-indexed
    }
  }
  return -1;
}

// ─── Google Service Account JWT ──────────────────────────────────────────────

async function getGoogleServiceToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claim));
  const signInput = `${encodedHeader}.${encodedClaim}`;

  const key = await importPrivateKey(normalizePrivateKey(PRIVATE_KEY!));
  const signature = await signRs256(key, signInput);

  const jwt = `${signInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text();
    throw new Error(`Google OAuth token exchange failed (${tokenResp.status}): ${text}`);
  }

  const tokenData = await tokenResp.json();
  return tokenData.access_token;
}

function normalizePrivateKey(key: string): string {
  // Handle escaped newlines from environment variables
  return key.replace(/\\n/g, "\n").trim();
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const der = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function signRs256(key: CryptoKey, data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, bytes);
  return base64urlBytes(new Uint8Array(sig));
}

function base64url(str: string): string {
  return base64urlBytes(new TextEncoder().encode(str));
}

function base64urlBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
