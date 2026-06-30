import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";

type ErrorCode =
  | "internal_error"
  | "method_not_allowed"
  | "not_authenticated"
  | "unsettled_balances";

type RpcError = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

function json(status: number, body: { deleted: true } | { error: ErrorCode }) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    },
    status
  });
}

function redactPhoneLikeValues(value: string): string {
  return value
    .replace(/\+8801[3-9]\d{8}/g, "+880**********")
    .replace(/\b01[3-9]\d{8}\b/g, "01*********");
}

function logDeleteAccountError(error: unknown, context: Record<string, string | number>) {
  const fields: Record<string, string | number> = { ...context };

  if (typeof error === "object" && error !== null) {
    const maybe = error as RpcError;
    if (maybe.code) fields.code = maybe.code;
    if (maybe.name) fields.name = maybe.name;
    if (typeof maybe.status === "number") fields.status = maybe.status;
    if (maybe.message) fields.message = redactPhoneLikeValues(maybe.message);
  } else if (typeof error === "string") {
    fields.message = redactPhoneLikeValues(error);
  }

  console.error("delete-account failed", fields);
}

function mapRpcError(error: RpcError): { error: ErrorCode; status: number } {
  const code = error.code ?? "";
  const message = error.message ?? "";
  const normalized = `${code} ${message}`.toLowerCase();

  if (code === "P0001" && message.includes("unsettled_balances")) {
    return { error: "unsettled_balances", status: 409 };
  }

  if (
    code === "28000" ||
    code === "401" ||
    code === "PGRST301" ||
    normalized.includes("jwt") ||
    normalized.includes("not_authenticated") ||
    normalized.includes("permission denied")
  ) {
    return { error: "not_authenticated", status: 401 };
  }

  return { error: "internal_error", status: 500 };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
    return json(401, { error: "not_authenticated" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    logDeleteAccountError("Missing Supabase Edge Function environment", {
      feature: "account.delete"
    });
    return json(500, { error: "internal_error" });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: authorization,
        "x-client-info": "baki-delete-account-edge"
      }
    }
  });

  const { error } = await supabase.rpc("delete_my_account");

  if (error) {
    const mapped = mapRpcError(error);
    logDeleteAccountError(error, {
      feature: "account.delete",
      mappedError: mapped.error,
      status: mapped.status
    });
    return json(mapped.status, { error: mapped.error });
  }

  return json(200, { deleted: true });
});
