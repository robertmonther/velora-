// Velora: the payment provider tells us that a payment went through.
// Stripe calls this address after a checkout. The message is accepted only when its signature fits our webhook
// secret; then the license (rent or buy) or the Premium time is written by the database, once per payment.
// Messages to switch on at the provider for this address: checkout.session.completed,
// checkout.session.async_payment_succeeded, invoice.paid, customer.subscription.deleted, charge.refunded.
//
// Needs, as secrets of the Supabase project (entered in the dashboard, never in this repo):
//   STRIPE_WEBHOOK_SECRET   the signing secret of this webhook endpoint (starts with "whsec_")
// No library: only fetch and Web Crypto, so the same file runs in the tests (tests/payments_server.mjs).

type Env = Record<string, string | undefined>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function serverKey(env: Env): string {
  try { const k = JSON.parse(env.SUPABASE_SECRET_KEYS ?? "{}"); if (k && typeof k.default === "string" && k.default) return k.default; } catch (_) { /* fall through */ }
  return env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}
async function rpc(env: Env, f: typeof fetch, name: string, args: unknown) {
  const key = serverKey(env);
  const r = await f(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(args ?? {}) });
  if (!r.ok) throw new Error(`database ${name}: ${r.status}`);
  return r.json();
}

// Stripe signs "<time>.<body>" with HMAC-SHA256. Accept only a fitting signature that is at most five minutes old.
export async function signatureOk(body: string, header: string, secret: string, nowSec: number): Promise<boolean> {
  if (!secret || !header) return false;
  const parts = header.split(",").map((x) => x.trim().split("=")), t = (parts.find((x) => x[0] === "t") || [])[1];
  const sigs = parts.filter((x) => x[0] === "v1").map((x) => x[1]);
  if (!t || !/^[0-9]+$/.test(t) || !sigs.length || Math.abs(nowSec - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  const want = [...mac].map((x) => x.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => { if (!s || s.length !== want.length) return false; let d = 0; for (let i = 0; i < want.length; i++) d |= s.charCodeAt(i) ^ want.charCodeAt(i); return d === 0; });
}

// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>;
// The provider names things by an id, or by a whole object that carries the id.
const idOf = (v: unknown): string => typeof v === "string" ? v : (v && typeof (v as Obj).id === "string") ? (v as Obj).id : "";
export async function handle(req: Request, env: Env, f: typeof fetch, nowSec = Math.floor(Date.now() / 1000)): Promise<Response> {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const body = await req.text();
  if (!(await signatureOk(body, req.headers.get("Stripe-Signature") ?? "", env.STRIPE_WEBHOOK_SECRET ?? "", nowSec))) return json({ ok: false, error: "bad signature" }, 400);
  let ev: Obj;
  try { ev = JSON.parse(body); } catch (_) { return json({ ok: false }, 400); }
  const o: Obj = (ev.data && ev.data.object) || {};
  try {
    if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
      const m: Obj = o.metadata || {}, who: Obj = o.customer_details || {};
      if (o.mode === "payment" && o.payment_status === "paid" && (m.kind === "rent" || m.kind === "buy")) {
        const pay = idOf(o.payment_intent);
        await rpc(env, f, "record_purchase", { p: { kind: m.kind, song_id: m.song_id, song_title: m.song_title, buyer_name: m.buyer_name || who.name || "", buyer_email: who.email || o.customer_email || "",
          amount_cents: o.amount_total, currency: o.currency, payment_ref: o.id, provider_ref: pay, user_id: m.user_id || o.client_reference_id || "", consent_at: m.consent_at || "" } });
      } else if (o.mode === "subscription" && (m.user_id || o.client_reference_id)) {
        await rpc(env, f, "record_premium", { p: { user_id: m.user_id || o.client_reference_id, until: new Date((nowSec + 32 * 86400) * 1000).toISOString(), mode: "extend", payment_ref: o.id, customer: idOf(o.customer) } });
      }
    } else if (ev.type === "invoice.paid") {                      // each monthly payment moves Premium to the end of the paid period
      const sd: Obj = o.subscription_details || (o.parent && o.parent.subscription_details) || {}, m: Obj = sd.metadata || {};
      const line: Obj = (o.lines && o.lines.data && o.lines.data[0]) || {}, end = line.period && line.period.end;
      if (m.user_id && end) await rpc(env, f, "record_premium", { p: { user_id: m.user_id, until: new Date((Number(end) + 2 * 86400) * 1000).toISOString(), mode: "extend", payment_ref: o.id, customer: idOf(o.customer) } });
    } else if (ev.type === "customer.subscription.deleted") {     // cancelled and run out: Premium ends now
      const m: Obj = o.metadata || {};
      if (m.user_id) await rpc(env, f, "record_premium", { p: { user_id: m.user_id, until: new Date(nowSec * 1000).toISOString(), mode: "set", payment_ref: o.id } });
    } else if (ev.type === "charge.refunded") {                   // refunded in full: the license no longer counts
      const pay = idOf(o.payment_intent);
      if (o.refunded === true && pay) await rpc(env, f, "record_refund", { p: { provider_ref: pay } });
    }
  } catch (_) { return json({ ok: false, error: "not recorded" }, 500); }   // the provider will send it again
  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D && D.serve) D.serve((req: Request) => handle(req, D.env.toObject(), fetch));
