// Velora: one-time owner setup.
// Creates the owner's account (email + password, no confirmation email needed) when the caller knows the setup code.
// The code's fingerprint lives in the database (private.owner_setup); it works once and locks after 10 wrong tries.
// This function does its own check (the setup code), so it runs without a signed-in user (verify_jwt = false).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// The server-side key: the new "secret" key when the project has one, otherwise the legacy service-role key.
function serverKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (keys && typeof keys.default === "string" && keys.default) return keys.default;
  } catch (_) { /* fall through */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch (_) { return json({ ok: false, error: "The request could not be read." }, 400); }
  const email = String(b?.email ?? "").trim().toLowerCase();
  const password = String(b?.password ?? "");
  const code = String(b?.code ?? "").trim();
  const name = String(b?.name ?? "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ ok: false, error: "Enter a valid email address." }, 400);
  if (password.length < 12 || password.length > 200) return json({ ok: false, error: "Use a password of 12 characters or more." }, 400);
  if (!name) return json({ ok: false, error: "Enter your name." }, 400);
  if (code.length < 8 || code.length > 80) return json({ ok: false, error: "The setup code is not right." }, 403);

  const key = serverKey();
  if (!key) return json({ ok: false, error: "The server is not ready for setup." }, 500);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const chk = await admin.rpc("owner_setup_check", { p_code: code });
  if (chk.error) return json({ ok: false, error: "The server could not check the code." }, 500);
  if (chk.data !== "ok") {
    const why = chk.data === "used" ? "The owner account already exists. Sign in instead."
      : chk.data === "locked" ? "Too many wrong codes. A new setup code is needed."
      : chk.data === "closed" ? "Owner setup is closed."
      : "The setup code is not right.";
    return json({ ok: false, error: why }, 403);
  }

  const made = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (made.error || !made.data?.user) {
    const m = made.error?.message ?? "";
    return json({ ok: false, error: /already|registered|exists/i.test(m) ? "An account with this email already exists." : "The account could not be created. " + m }, 400);
  }
  const fin = await admin.rpc("owner_setup_finish", { p_code: code, p_user: made.data.user.id, p_name: name });
  if (fin.error || fin.data !== "ok") {
    await admin.auth.admin.deleteUser(made.data.user.id);
    return json({ ok: false, error: "The setup could not be finished. Please try again." }, 500);
  }
  return json({ ok: true });
});
