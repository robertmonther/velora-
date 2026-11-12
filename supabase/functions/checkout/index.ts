// Velora: start a payment.
// The site sends what the visitor wants (rent or buy one song, or Premium); this function creates a checkout page at
// the payment provider (Stripe Checkout) and answers with its address. Prices come from the database (private.shop),
// never from the browser. It answers { ok:false, closed:true } while payments are switched off (the default).
//
// kind "manage" opens the provider's own page where a member changes the payment method or cancels Premium.
//
// Needs, as secrets of the Supabase project (entered in the dashboard, never in this repo):
//   STRIPE_SECRET_KEY   the provider's secret key
//   SITE_ORIGINS        the site's addresses, comma-separated, e.g. "https://velora.example,https://www.velora.example"
//   SITE_NAME           optional: the name shown at the provider ("<name> Premium"); "Velora" until the real name is chosen
//
// Who the seller is, and tax (all optional; see docs/PAYMENTS.md, "The seller and VAT"):
//   STRIPE_MANAGED_PAYMENTS   "off" (the default): our own business is the seller, as the legal pages say.
//                             "on": Stripe is the seller ("merchant of record") and handles the tax; every product
//                             then needs a tax code. New Stripe accounts have this on by default, which is why this
//                             function says "off" on every checkout unless it is set to "on" here.
//   STRIPE_TAX_CODE_RENT, STRIPE_TAX_CODE_BUY, STRIPE_TAX_CODE_PREMIUM   the provider's product tax codes ("txcd_...").
//                             Needed when Managed Payments is "on"; otherwise only used when given.
//   STRIPE_AUTOMATIC_TAX      "on": our business stays the seller and the provider works out the VAT (Stripe Tax).
// No library: only fetch, so the same file runs in the tests (tests/payments_server.mjs).

type Env = Record<string, string | undefined>;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
// Text from the browser: no control characters, no angle brackets, a sensible length.
const UNSAFE = new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + "<>]", "g");
const clean = (v: unknown, max: number) => String(v ?? "").replace(UNSAFE, "").trim().slice(0, max);
const isOn = (v: unknown) => String(v ?? "").trim().toLowerCase() === "on";

export function serverKey(env: Env): string {
  try { const k = JSON.parse(env.SUPABASE_SECRET_KEYS ?? "{}"); if (k && typeof k.default === "string" && k.default) return k.default; } catch (_) { /* fall through */ }
  return env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}
// Call a database function with the server's own key.
export async function rpc(env: Env, f: typeof fetch, name: string, args: unknown) {
  const key = serverKey(env);
  const r = await f(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(args ?? {}) });
  if (!r.ok) throw new Error(`database ${name}: ${r.status}`);
  return r.json();
}

export async function handle(req: Request, env: Env, f: typeof fetch): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch (_) { return json({ ok: false, error: "The request could not be read." }, 400); }
  const kind = String(b.kind ?? "");
  if (!["rent", "buy", "premium", "manage"].includes(kind)) return json({ ok: false, error: "Choose rent, buy or Premium." }, 400);

  let shop: Record<string, unknown>;
  try { shop = await rpc(env, f, "shop_info", {}); } catch (_) { return json({ ok: false, error: "The shop could not be reached." }, 500); }
  const secret = env.STRIPE_SECRET_KEY ?? "";
  // A member can always manage or cancel Premium, also while the shop is closed to new sales.
  if (!shop || !secret || (shop.open !== true && kind !== "manage")) return json({ ok: false, closed: true });

  // The name on the license is optional here: without one, the webhook takes the name the buyer pays with.
  const songId = String(b.song_id ?? ""), name = clean(b.buyer_name, 120);
  let title = "";
  if (kind === "rent" || kind === "buy") {
    if (!/^(rm|vs)-[0-9]{4,}$/.test(songId)) return json({ ok: false, error: "That song is not known." }, 400);
    // EU rule for digital content: delivery starts at once only with the buyer's express consent (see docs/LEGAL.md).
    if (b.consent !== true) return json({ ok: false, error: "Tick the box about immediate delivery to continue." }, 400);
    // Only songs the server knows are sold, under the catalogue's own title (whatever title the browser sent).
    try { title = clean(await rpc(env, f, "song_title", { p_song: songId }), 160); } catch (e) { console.error("checkout: song_title failed", String(e)); return json({ ok: false, error: "The shop could not be reached." }, 500); }
    if (!title) return json({ ok: false, error: "That song is not known." }, 400);
  }
  // Where the buyer comes back to: only the site's own addresses.
  const origins = (env.SITE_ORIGINS ?? "").split(",").map((s) => s.trim().replace(/[/]+$/, "")).filter(Boolean);
  let back: URL;
  try { back = new URL(String(b.return_url ?? "")); } catch (_) { return json({ ok: false, error: "The return address is missing." }, 400); }
  if (!origins.includes(back.origin)) return json({ ok: false, error: "This site address is not set up for payments." }, 400);
  const home = back.origin + back.pathname;

  // Signed in? Then the purchase goes straight into that account. Premium needs an account.
  let user: { id: string; email: string } | null = null;
  const auth = req.headers.get("Authorization") ?? "", token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token && token.split(".").length === 3) {
    try {
      const r = await f(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: serverKey(env), Authorization: `Bearer ${token}` } });
      if (r.ok) { const u = await r.json(); if (u && u.id) user = { id: String(u.id), email: String(u.email ?? "") }; }
    } catch (_) { /* treated as not signed in */ }
  }
  if ((kind === "premium" || kind === "manage") && !user) return json({ ok: false, error: "Sign in or create an account first: Premium belongs to an account.", needAccount: true }, 401);
  const stripe = (path: string, form: URLSearchParams) => f("https://api.stripe.com/v1/" + path, { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });

  if (kind === "manage") {           // the provider's own page to change the payment method, see invoices or cancel Premium
    let customer = "";
    try { customer = String((await rpc(env, f, "premium_customer", { p_user: user!.id })) ?? ""); } catch (_) { return json({ ok: false, error: "The shop could not be reached." }, 500); }
    if (!customer) return json({ ok: false, error: "There is no Premium payment on this account." }, 404);
    let r: Response;
    try { r = await stripe("billing_portal/sessions", new URLSearchParams({ customer, return_url: `${home}#/account` })); }
    catch (_) { return json({ ok: false, error: "The payment provider could not be reached. Try again." }, 502); }
    const s = await r.json().catch(() => ({}));
    if (!r.ok || !s || typeof s.url !== "string") return json({ ok: false, error: "That page could not be opened. Try again." }, 502);
    return json({ ok: true, url: s.url });
  }

  const brand = clean(env.SITE_NAME, 40) || "Velora";
  const cur = String(shop.currency ?? "eur"), cents = Number(kind === "rent" ? shop.rent : kind === "buy" ? shop.buy : shop.premium);
  if (!Number.isInteger(cents) || cents < 50) return json({ ok: false, error: "The price is not set." }, 500);
  // Who sells, and tax. A tax code is the provider's own identifier: taken as given, never made up here.
  const managed = isOn(env.STRIPE_MANAGED_PAYMENTS), autoTax = !managed && isOn(env.STRIPE_AUTOMATIC_TAX);
  const given = clean(env["STRIPE_TAX_CODE_" + kind.toUpperCase()], 40), taxCode = /^txcd_[0-9]+$/.test(given) ? given : "";
  if (managed && !taxCode) { console.error("checkout: Managed Payments is on but there is no tax code for", kind); return json({ ok: false, error: "The payment could not be started. Try again." }, 500); }
  const p = new URLSearchParams();
  const meta: Record<string, string> = { kind, song_id: songId, song_title: title, buyer_name: name, user_id: user ? user.id : "", consent_at: kind === "premium" ? "" : new Date().toISOString() };
  p.set("mode", kind === "premium" ? "subscription" : "payment");
  // The provider puts its checkout reference in place of {CHECKOUT_SESSION_ID}; the site turns ?paid= into its thanks page.
  p.set("success_url", `${home}?paid={CHECKOUT_SESSION_ID}&kind=${kind}#/thanks`);
  p.set("cancel_url", `${home}#/${kind === "premium" ? "pricing" : "song/" + songId}`);
  p.set("line_items[0][quantity]", "1");
  p.set("line_items[0][price_data][currency]", cur);
  p.set("line_items[0][price_data][unit_amount]", String(cents));
  p.set("line_items[0][price_data][product_data][name]", kind === "premium" ? `${brand} Premium` : `${kind === "rent" ? "Rent" : "Usage rights"}: ${title}`);
  if (kind === "premium") p.set("line_items[0][price_data][recurring][interval]", "month");
  p.set("managed_payments[enabled]", managed ? "true" : "false");
  if (taxCode) p.set("line_items[0][price_data][product_data][tax_code]", taxCode);
  if (managed || autoTax) p.set("line_items[0][price_data][tax_behavior]", "inclusive");      // the prices shown already include VAT
  if (autoTax) p.set("automatic_tax[enabled]", "true");
  if (user) { p.set("client_reference_id", user.id); if (user.email) p.set("customer_email", user.email); }
  for (const [k, v] of Object.entries(meta)) { p.set(`metadata[${k}]`, v); if (kind === "premium") p.set(`subscription_data[metadata][${k}]`, v); }

  // deno-lint-ignore no-explicit-any
  const create = async () => { const r = await stripe("checkout/sessions", p); const s: any = await r.json().catch(() => ({})); return { r, s }; };
  let out: Awaited<ReturnType<typeof create>>;
  try {
    out = await create();
    // An account on an older version of the provider's interface does not know the Managed Payments switch, and has
    // nothing to switch off: ask once more without it. (Never when it is meant to be on: that would change the seller.)
    const e = out.s && out.s.error;
    if (!out.r.ok && !managed && e && e.code === "parameter_unknown" && String(e.param ?? "").startsWith("managed_payments")) { p.delete("managed_payments[enabled]"); out = await create(); }
  } catch (_) { return json({ ok: false, error: "The payment provider could not be reached. Try again." }, 502); }
  const { r, s } = out;
  if (!r.ok || !s || typeof s.url !== "string") {
    // The reason by its code and the field's name only: never the provider's sentence (it can repeat what the buyer typed), never the key.
    console.error("checkout: the provider refused", r.status, s && s.error ? clean(s.error.code || s.error.type, 60) : "", s && s.error ? clean(s.error.param, 120) : "");
    return json({ ok: false, error: "The payment could not be started. Try again." }, 502);
  }
  return json({ ok: true, url: s.url });
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D && D.serve) D.serve((req: Request) => handle(req, D.env.toObject(), fetch));
