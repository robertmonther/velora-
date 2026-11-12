// Checks for the two payment server functions, run with their real code and a stand-in for the network:
//   node --experimental-strip-types tests/payments_server.mjs
// Nothing is sent anywhere: the database and the payment provider are played by the function "net" below.
import { createHmac } from "node:crypto";
const { handle: checkout } = await import("../supabase/functions/checkout/index.ts");
const { handle: webhook, signatureOk } = await import("../supabase/functions/payment-webhook/index.ts");

let pass = 0, total = 0;
const check = (name, ok, detail = "") => { total++; if (ok) pass++; console.log((ok ? "PASS  " : "FAIL  ") + name + (!ok && detail ? "   [" + detail + "]" : "")); };
const ENV = { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "server-key", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_test", SITE_ORIGINS: "https://velora.test, https://www.velora.test/" };
const SHOP = { open: true, currency: "eur", rent: 900, buy: 4900, premium: 1400, rent_days: 30 };
const USER_JWT = "aaa.bbb.ccc";

function net(opts = {}) {            // plays the database, the sign-in service and the payment provider; remembers every call
  const calls = [];
  const f = async (url, init = {}) => {
    const c = { url: String(url), method: init.method || "GET", headers: init.headers || {}, body: init.body || "" }; calls.push(c);
    const ok = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    if (c.url.endsWith("/rest/v1/rpc/shop_info")) return ok(opts.shop || SHOP);
    if (c.url.endsWith("/rest/v1/rpc/song_title")) return ok(JSON.parse(c.body).p_song === "rm-0007" ? "Live Footage of Me Ruining This" : null);
    if (c.url.endsWith("/rest/v1/rpc/premium_customer")) return ok(opts.customer === undefined ? "cus_test_9" : opts.customer);
    if (c.url === "https://api.stripe.com/v1/billing_portal/sessions") return ok({ id: "bps_1", url: "https://billing.stripe.test/p/session/bps_1" });
    if (c.url.includes("/rest/v1/rpc/")) return opts.dbDown ? ok({ message: "down" }, 500) : ok({ id: "VL-2026-ABCDEF1234" });
    if (c.url.endsWith("/auth/v1/user")) return c.headers.Authorization === "Bearer " + USER_JWT ? ok({ id: "11111111-1111-1111-1111-111111111111", email: "lina@example.test" }) : ok({ msg: "no" }, 401);
    if (c.url === "https://api.stripe.com/v1/checkout/sessions") {
      // An account on an old version of the provider's interface does not know the "managed payments" switch.
      if (opts.oldApi && new URLSearchParams(c.body).has("managed_payments[enabled]")) return ok({ error: { type: "invalid_request_error", code: "parameter_unknown", param: "managed_payments", message: "Received unknown parameter: managed_payments" } }, 400);
      if (opts.refuse) return ok({ error: { type: "invalid_request_error", code: "parameter_missing", param: "line_items[0][price_data][product_data][tax_code]", message: "Product tax code is required for lina@example.test" } }, 400);
      return ok({ id: "cs_test_123", url: "https://checkout.stripe.test/c/pay/cs_test_123" });
    }
    return ok({}, 404);
  };
  return { f, calls };
}
const post = (body, headers = {}) => new Request("https://fn.test/checkout", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const RENT = { kind: "rent", song_id: "rm-0007", song_title: "A <b>title</b> the browser made up", buyer_name: "Lina <b>Test</b>", consent: true, return_url: "https://velora.test/index.html#/song/rm-0007", amount: 1 };

// ---------- starting a payment ----------
{
  let n = net({ shop: { ...SHOP, open: false } }); let r = await (await checkout(post(RENT), ENV, n.f)).json();
  let n2 = net(); let r2 = await (await checkout(post(RENT), { ...ENV, STRIPE_SECRET_KEY: "" }, n2.f)).json();
  check("payments switched off (or no provider key): the answer is 'closed' and the provider is never called", r.closed === true && r2.closed === true && !n.calls.concat(n2.calls).some(c => c.url.includes("stripe")), JSON.stringify([r, r2]));

  n = net(); let res = await checkout(post({ ...RENT, consent: false }), ENV, n.f); r = await res.json();
  check("no consent to immediate delivery: refused", res.status === 400 && /Tick the box/.test(r.error) && !n.calls.some(c => c.url.includes("stripe")), JSON.stringify(r));
  n = net(); res = await checkout(post({ ...RENT, return_url: "https://evil.test/x" }), ENV, n.f);
  check("a return address that is not the site's own: refused", res.status === 400 && !n.calls.some(c => c.url.includes("stripe")));
  n = net(); res = await checkout(post({ ...RENT, song_id: "x'; drop" }), ENV, n.f);
  const n6 = net(); const res6 = await checkout(post({ ...RENT, song_id: "rm-9999" }), ENV, n6.f);
  check("a song id of the wrong shape, or a song the server does not know: refused", res.status === 400 && res6.status === 400 && !n.calls.concat(n6.calls).some(c => c.url.includes("stripe")));
  n = net(); res = await checkout(post({ kind: "premium", return_url: "https://velora.test/" }), ENV, n.f); r = await res.json();
  check("Premium without an account: asks to sign in first", res.status === 401 && r.needAccount === true && !n.calls.some(c => c.url.includes("stripe")));

  n = net(); res = await checkout(post(RENT), ENV, n.f); r = await res.json();
  const s = n.calls.find(c => c.url.includes("stripe")), q = new URLSearchParams(s ? s.body : "");
  check("rent: the provider gets the price and the song's title from the database (not from the browser), the cleaned name and the consent time", r.ok && r.url.includes("cs_test_123") && s.headers.Authorization === "Bearer sk_test_x"
    && q.get("mode") === "payment" && q.get("line_items[0][price_data][unit_amount]") === "900" && q.get("line_items[0][price_data][currency]") === "eur"
    && q.get("line_items[0][price_data][product_data][name]") === "Rent: Live Footage of Me Ruining This" && q.get("metadata[song_title]") === "Live Footage of Me Ruining This" && q.get("metadata[kind]") === "rent" && q.get("metadata[song_id]") === "rm-0007"
    && q.get("metadata[buyer_name]") === "Lina bTest/b" && /^\d{4}-\d\d-\d\dT/.test(q.get("metadata[consent_at]")) && q.get("metadata[user_id]") === "" && !q.has("client_reference_id"), s ? s.body : "no call");
  check("the buyer comes back to the site's thanks page with the provider's reference; cancelling goes back to the song", q.get("success_url") === "https://velora.test/index.html?paid={CHECKOUT_SESSION_ID}&kind=rent#/thanks" && q.get("cancel_url") === "https://velora.test/index.html#/song/rm-0007", q.get("success_url"));
  n = net(); res = await checkout(post({ ...RENT, buyer_name: "" }), ENV, n.f); r = await res.json();
  check("no name typed: the payment still starts (the license takes the name the buyer pays with)", r.ok === true && new URLSearchParams(n.calls.find(c => c.url.includes("stripe")).body).get("metadata[buyer_name]") === "");

  n = net(); res = await checkout(post({ ...RENT, kind: "buy", return_url: "https://www.velora.test/" }, { Authorization: "Bearer " + USER_JWT }), ENV, n.f); r = await res.json();
  const q2 = new URLSearchParams(n.calls.find(c => c.url.includes("stripe")).body);
  check("buy, signed in: the purchase is tied to the account", r.ok && q2.get("line_items[0][price_data][unit_amount]") === "4900" && q2.get("client_reference_id") === "11111111-1111-1111-1111-111111111111" && q2.get("customer_email") === "lina@example.test" && q2.get("metadata[user_id]") === "11111111-1111-1111-1111-111111111111");
  n = net(); res = await checkout(post({ kind: "premium", return_url: "https://velora.test/" }, { Authorization: "Bearer " + USER_JWT }), ENV, n.f); r = await res.json();
  const q3 = new URLSearchParams(n.calls.find(c => c.url.includes("stripe")).body);
  check("Premium, signed in: a monthly subscription that carries the account", r.ok && q3.get("mode") === "subscription" && q3.get("line_items[0][price_data][recurring][interval]") === "month" && q3.get("line_items[0][price_data][unit_amount]") === "1400" && q3.get("subscription_data[metadata][user_id]") === "11111111-1111-1111-1111-111111111111" && q3.get("cancel_url") === "https://velora.test/#/pricing");

  // managing or cancelling Premium
  n = net({ shop: { ...SHOP, open: false } }); res = await checkout(post({ kind: "manage", return_url: "https://velora.test/index.html" }, { Authorization: "Bearer " + USER_JWT }), ENV, n.f); r = await res.json();
  const pq = new URLSearchParams((n.calls.find(c => c.url.includes("billing_portal")) || {}).body || "");
  check("a member opens the provider's page to manage or cancel Premium, also while the shop is closed", r.ok && r.url.includes("bps_1") && pq.get("customer") === "cus_test_9" && pq.get("return_url") === "https://velora.test/index.html#/account"
    && JSON.parse(n.calls.find(c => c.url.endsWith("/rpc/premium_customer")).body).p_user === "11111111-1111-1111-1111-111111111111", JSON.stringify(r));
  n = net(); res = await checkout(post({ kind: "manage", return_url: "https://velora.test/" }), ENV, n.f);
  const n5 = net({ customer: null }); const res5 = await checkout(post({ kind: "manage", return_url: "https://velora.test/" }, { Authorization: "Bearer " + USER_JWT }), ENV, n5.f);
  check("managing Premium needs the signed-in member, and an account that never paid gets a plain answer", res.status === 401 && res5.status === 404 && !n.calls.concat(n5.calls).some(c => c.url.includes("stripe")));
  n = net(); await checkout(post({ kind: "premium", return_url: "https://velora.test/" }, { Authorization: "Bearer " + USER_JWT }), { ...ENV, SITE_NAME: "Nova <Sound>" }, n.f);
  check("the name shown at the provider can be changed without touching the code", new URLSearchParams(n.calls.find(c => c.url.includes("stripe")).body).get("line_items[0][price_data][product_data][name]") === "Nova Sound Premium");

  // who the seller is, and tax (found on the real provider's test account on 12 November 2026)
  const form = (m) => new URLSearchParams(m.calls.filter(c => c.url.endsWith("/checkout/sessions")).pop().body);
  const TAX = "line_items[0][price_data][product_data][tax_code]", BEHAV = "line_items[0][price_data][tax_behavior]", PREMIUM = { kind: "premium", return_url: "https://velora.test/" }, AUTH = { Authorization: "Bearer " + USER_JWT };
  check("our own business is the seller unless set otherwise: every checkout switches the provider's 'managed payments' off, with no tax settings", q.get("managed_payments[enabled]") === "false" && q3.get("managed_payments[enabled]") === "false" && q2.get("managed_payments[enabled]") === "false"
    && !q.has(TAX) && !q.has(BEHAV) && !q.has("automatic_tax[enabled]"), s.body);
  n = net({ oldApi: true }); res = await checkout(post(RENT), ENV, n.f); r = await res.json();
  const tries = n.calls.filter(c => c.url.endsWith("/checkout/sessions"));
  check("a provider account that does not know that switch: asked once more without it, and the payment starts", r.ok === true && tries.length === 2 && new URLSearchParams(tries[0].body).has("managed_payments[enabled]") && !new URLSearchParams(tries[1].body).has("managed_payments[enabled]")
    && new URLSearchParams(tries[1].body).get("line_items[0][price_data][unit_amount]") === "900", JSON.stringify(r));
  const CODES = { STRIPE_TAX_CODE_RENT: "txcd_10401001", STRIPE_TAX_CODE_BUY: "txcd_10401100", STRIPE_TAX_CODE_PREMIUM: "txcd_10401200" };
  n = net(); res = await checkout(post(RENT), { ...ENV, STRIPE_MANAGED_PAYMENTS: "on" }, n.f); r = await res.json();
  const nb = net(); const resb = await checkout(post(RENT), { ...ENV, STRIPE_MANAGED_PAYMENTS: "on", STRIPE_TAX_CODE_RENT: "audio" }, nb.f);
  check("'managed payments' switched on without a product tax code (or with a malformed one): refused before the provider is asked", res.status === 500 && r.ok === false && resb.status === 500 && !n.calls.concat(nb.calls).some(c => c.url.includes("stripe")), JSON.stringify(r));
  n = net(); res = await checkout(post(RENT), { ...ENV, ...CODES, STRIPE_MANAGED_PAYMENTS: " On " }, n.f); r = await res.json(); let qm = form(n);
  const nc = net(); await checkout(post({ ...RENT, kind: "buy" }), { ...ENV, ...CODES, STRIPE_MANAGED_PAYMENTS: "on" }, nc.f);
  const nd = net(); await checkout(post(PREMIUM, AUTH), { ...ENV, ...CODES, STRIPE_MANAGED_PAYMENTS: "on", STRIPE_AUTOMATIC_TAX: "on" }, nd.f);
  check("'managed payments' switched on: each product carries its own tax code, the price includes tax, and the provider works out the tax itself", r.ok === true && qm.get("managed_payments[enabled]") === "true" && qm.get(TAX) === "txcd_10401001" && qm.get(BEHAV) === "inclusive" && !qm.has("automatic_tax[enabled]")
    && form(nc).get(TAX) === "txcd_10401100" && form(nd).get(TAX) === "txcd_10401200" && form(nd).get("managed_payments[enabled]") === "true" && !form(nd).has("automatic_tax[enabled]"), qm.toString());
  n = net({ oldApi: true }); res = await checkout(post(RENT), { ...ENV, ...CODES, STRIPE_MANAGED_PAYMENTS: "on" }, n.f);
  check("'managed payments' switched on at an account that does not know it: the payment does not start (no silent fall-back to another seller)", res.status === 502 && n.calls.filter(c => c.url.endsWith("/checkout/sessions")).length === 1);
  n = net(); res = await checkout(post(RENT), { ...ENV, STRIPE_AUTOMATIC_TAX: "on", STRIPE_TAX_CODE_RENT: "txcd_10401001" }, n.f); r = await res.json(); qm = form(n);
  const ne = net(); await checkout(post(RENT), { ...ENV, STRIPE_AUTOMATIC_TAX: "on" }, ne.f);
  check("automatic tax switched on (our business stays the seller): the provider works out the VAT inside the price; a tax code is optional", r.ok === true && qm.get("automatic_tax[enabled]") === "true" && qm.get(BEHAV) === "inclusive" && qm.get(TAX) === "txcd_10401001" && qm.get("managed_payments[enabled]") === "false"
    && form(ne).get("automatic_tax[enabled]") === "true" && !form(ne).has(TAX), qm.toString());
  const logged = []; const keep = console.error; console.error = (...a) => logged.push(a.join(" "));
  n = net({ refuse: true }); res = await checkout(post(RENT, AUTH), ENV, n.f); r = await res.json(); console.error = keep;
  check("when the provider refuses, the buyer gets a plain answer and the log names the reason, never the buyer or the key", res.status === 502 && r.ok === false && !/tax|lina/i.test(JSON.stringify(r)) && logged.length === 1 && /parameter_missing/.test(logged[0]) && /tax_code/.test(logged[0]) && !/lina|sk_test/.test(logged[0]), logged.join(" | "));
}

// ---------- the provider's message ----------
{
  const NOW = 1794400000, sign = (body, t = NOW, secret = "whsec_test") => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  const send = async (ev, n, hdr) => { const body = JSON.stringify(ev); return webhook(new Request("https://fn.test/hook", { method: "POST", headers: { "Stripe-Signature": hdr === undefined ? sign(body) : hdr }, body }), ENV, n.f, NOW); };
  const paid = { type: "checkout.session.completed", data: { object: { id: "cs_live_abc", mode: "payment", payment_status: "paid", payment_intent: "pi_live_1", amount_total: 900, currency: "eur", customer_details: { email: "Lina@Example.test", name: "Lina T" },
    metadata: { kind: "rent", song_id: "rm-0007", song_title: "Live Footage of Me Ruining This", buyer_name: "Lina Test", user_id: "", consent_at: "2026-11-11T22:00:00.000Z" } } } };
  const body = JSON.stringify(paid);
  check("signature: the right one passes; a wrong secret, a changed body, an old message and a missing header do not",
    await signatureOk(body, sign(body), "whsec_test", NOW) && !(await signatureOk(body, sign(body, NOW, "whsec_other"), "whsec_test", NOW)) && !(await signatureOk(body + " ", sign(body), "whsec_test", NOW))
    && !(await signatureOk(body, sign(body, NOW - 301), "whsec_test", NOW)) && !(await signatureOk(body, "", "whsec_test", NOW)) && !(await signatureOk(body, sign(body), "", NOW)));

  let n = net(); let res = await send(paid, n, "t=1,v1=00");
  check("a message with a bad signature is refused and nothing is written", res.status === 400 && n.calls.length === 0);
  n = net(); res = await send(paid, n); let c = n.calls[0], p = c && JSON.parse(c.body).p;
  check("a paid checkout writes one license with the buyer, the amount, the reference and the consent time", res.status === 200 && n.calls.length === 1 && c.url.endsWith("/rpc/record_purchase") && c.headers.apikey === "server-key"
    && p.kind === "rent" && p.song_id === "rm-0007" && p.buyer_name === "Lina Test" && p.buyer_email === "Lina@Example.test" && p.amount_cents === 900 && p.payment_ref === "cs_live_abc" && p.provider_ref === "pi_live_1" && p.consent_at === "2026-11-11T22:00:00.000Z", c ? c.body : "");
  n = net(); res = await send({ ...paid, data: { object: { ...paid.data.object, metadata: { ...paid.data.object.metadata, buyer_name: "" } } } }, n);
  const n3 = net(); await send({ ...paid, type: "checkout.session.async_payment_succeeded" }, n3);
  check("no name was typed: the name the buyer paid with goes on the license; a payment confirmed later is written the same way", JSON.parse(n.calls[0].body).p.buyer_name === "Lina T" && n3.calls.length === 1 && n3.calls[0].url.endsWith("/rpc/record_purchase"));
  n = net(); res = await send({ ...paid, data: { object: { ...paid.data.object, payment_status: "unpaid" } } }, n);
  check("an unpaid checkout writes nothing", res.status === 200 && n.calls.length === 0);
  n = net({ dbDown: true }); res = await send(paid, n);
  check("if the database is down the provider is told to try again", res.status === 500);

  const uid = "11111111-1111-1111-1111-111111111111";
  n = net(); res = await send({ type: "checkout.session.completed", data: { object: { id: "cs_live_sub", mode: "subscription", payment_status: "paid", customer: "cus_live_7", client_reference_id: uid, metadata: { kind: "premium", user_id: uid } } } }, n);
  p = JSON.parse(n.calls[0].body).p;
  check("a Premium checkout turns Premium on for that account and keeps the provider's customer number (for cancelling later)", n.calls[0].url.endsWith("/rpc/record_premium") && p.user_id === uid && p.mode === "extend" && p.customer === "cus_live_7" && new Date(p.until).getTime() / 1000 === NOW + 32 * 86400);
  const end = NOW + 30 * 86400;
  n = net(); await send({ type: "invoice.paid", data: { object: { id: "in_1", subscription_details: { metadata: { user_id: uid } }, lines: { data: [{ period: { end } }] } } } }, n);
  const n2 = net(); await send({ type: "invoice.paid", data: { object: { id: "in_2", parent: { subscription_details: { metadata: { user_id: uid } } }, lines: { data: [{ period: { end } }] } } } }, n2);
  p = JSON.parse(n.calls[0].body).p; const p2 = JSON.parse(n2.calls[0].body).p;
  check("each monthly payment moves Premium to the end of the paid month (both message shapes)", p.user_id === uid && new Date(p.until).getTime() / 1000 === end + 2 * 86400 && p2.until === p.until && p2.mode === "extend");
  n = net(); await send({ type: "customer.subscription.deleted", data: { object: { id: "sub_1", metadata: { user_id: uid } } } }, n); p = JSON.parse(n.calls[0].body).p;
  check("a subscription that ended switches Premium off", p.mode === "set" && new Date(p.until).getTime() / 1000 === NOW);
  n = net(); await send({ type: "charge.refunded", data: { object: { id: "ch_1", payment_intent: "pi_live_1", refunded: true } } }, n);
  const n4 = net(); await send({ type: "charge.refunded", data: { object: { id: "ch_1", payment_intent: "pi_live_1", refunded: false, amount_refunded: 100 } } }, n4);
  check("a full refund marks the license as refunded; a part refund changes nothing", n.calls.length === 1 && n.calls[0].url.endsWith("/rpc/record_refund") && JSON.parse(n.calls[0].body).p.provider_ref === "pi_live_1" && n4.calls.length === 0);
  n = net(); res = await send({ type: "something.else", data: { object: {} } }, n);
  check("other messages are accepted and ignored", res.status === 200 && n.calls.length === 0);

  // The provider's own messages, as its test account really sent them on 12 November 2026 (interface version
  // 2026-08-26.dahlia): a first Premium payment, the end of that subscription, and a full refund. Cut down to the
  // fields around the ones we read, with neutral ids; the shape is the provider's, not ours.
  const realPaid = { id: "evt_1", object: "event", api_version: "2026-08-26.dahlia", type: "invoice.paid", data: { object: { id: "in_real_1", object: "invoice", account_country: "NL", amount_paid: 1400, billing_reason: "subscription_create",
    currency: "eur", customer: "cus_real_1", customer_email: "shape-check@example.com", metadata: {}, status: "paid", period_end: 1794474742, period_start: 1794474742,
    lines: { object: "list", has_more: false, total_count: 1, data: [{ id: "il_1", object: "line_item", amount: 1400, metadata: { kind: "premium", user_id: uid }, period: { end: 1797066742, start: 1794474742 },
      parent: { invoice_item_details: null, subscription_item_details: { subscription: "sub_real_1", subscription_item: "si_1" }, type: "subscription_item_details" } }] },
    parent: { quote_details: null, subscription_details: { metadata: { kind: "premium", user_id: uid }, subscription: "sub_real_1" }, type: "subscription_details" } } } };
  const realEnded = { id: "evt_2", object: "event", api_version: "2026-08-26.dahlia", type: "customer.subscription.deleted", data: { object: { id: "sub_real_1", object: "subscription", status: "canceled", canceled_at: 1794474762, ended_at: 1794474762,
    cancellation_details: { comment: null, feedback: null, reason: "cancellation_requested" }, customer: "cus_real_1", latest_invoice: "in_real_1", managed_payments: { enabled: false }, metadata: { kind: "premium", user_id: uid } } } };
  const realRefund = { id: "evt_3", object: "event", api_version: "2026-08-26.dahlia", type: "charge.refunded", data: { object: { id: "ch_real_1", object: "charge", amount: 1400, amount_captured: 1400, amount_refunded: 1400, captured: true, currency: "eur",
    customer: "cus_real_1", paid: true, payment_intent: "pi_real_1", refunded: true, status: "succeeded" }, previous_attributes: { amount_refunded: 0, refunded: false } } };
  n = net(); await send(realPaid, n); const na = net(); await send(realEnded, na); const nr = net(); await send(realRefund, nr);
  p = n.calls[0] && JSON.parse(n.calls[0].body).p; const pe = na.calls[0] && JSON.parse(na.calls[0].body).p, pr = nr.calls[0] && JSON.parse(nr.calls[0].body).p;
  check("the provider's real messages (copied from its test account) are read as meant: Premium runs to the end of the paid month, ends when the subscription ends, and a refund is found by its payment", n.calls.length === 1 && n.calls[0].url.endsWith("/rpc/record_premium")
    && p.user_id === uid && p.mode === "extend" && p.customer === "cus_real_1" && new Date(p.until).getTime() / 1000 === 1797066742 + 2 * 86400 && p.payment_ref === "in_real_1"
    && na.calls.length === 1 && pe.user_id === uid && pe.mode === "set" && pe.payment_ref === "sub_real_1"
    && nr.calls.length === 1 && nr.calls[0].url.endsWith("/rpc/record_refund") && pr.provider_ref === "pi_real_1", JSON.stringify([p, pe, pr]));
}
console.log(`\n${pass} of ${total} payment server checks passed`);
process.exit(pass === total ? 0 : 1);
