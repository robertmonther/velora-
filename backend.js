/* Velora backend: accounts, the songs uploaded through the site, and the upload API.
   It talks to a Supabase project (database, sign-in, file storage). The project's address and public key are in config.js;
   while they are empty this whole file stays off and the site works from the bundled catalogue alone.

   Security notes:
   - The public (anon) key is meant to be published. What protects the data is the database rules in supabase/schema.sql:
     visitors can only read published songs; writing goes through checked server functions.
   - Sign-in is email + password. On a shared test address (raw.githack.com serves every GitHub project from one web
     origin) the session is kept in memory only, so you sign in again after a reload. On the site's own address it is
     remembered on the device.
   - The Supabase library (vendor/supabase.js) is loaded only when someone signs in or uploads; listeners never download it. */
window.VeloraBackend = (function () {
  "use strict";
  const C = (window.VELORA_CONFIG || {}).supabase || {};
  const url = String(C.url || "").replace(/\/+$/, ""), key = String(C.anonKey || "");
  // The server's address: a Supabase project, or (only while the site itself runs on this computer) a local stand-in used by the tests.
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /^http:\/\/(localhost|127\.0\.0\.1):\d+\/[\w-]+$/.test(url);
  const enabled = (/^https:\/\/[a-z0-9]{10,40}\.supabase\.co$/.test(url) || local) && key.length >= 20;
  const shared = /(^|\.)githack\.com$|^htmlpreview\.github\.io$/i.test(location.hostname);
  const mem = {};
  const memStore = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  let client = null, libP = null, initP = null;
  const subs = [];
  // Is there a remembered sign-in on this device? Only then is the account library loaded when the site opens.
  const remembered = () => { if (!enabled || shared) return false; try { return !!localStorage.getItem("velora_auth"); } catch (e) { return false; } };
  const B = { enabled, url, shared, user: null, role: "", name: "", premium: false, ready: !remembered() };
  const notify = () => subs.forEach(f => { try { f(B); } catch (e) {} });

  function lib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (!libP) libP = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "vendor/supabase.js"; s.async = true;
      s.onload = () => (window.supabase && window.supabase.createClient ? res() : rej(new Error("The account library did not load.")));
      s.onerror = () => { libP = null; rej(new Error("The account library did not load. Check your connection.")); };
      document.head.appendChild(s);
    });
    return libP;
  }
  // Turn the server's technical messages into plain ones.
  function plain(err) {
    const m = String((err && (err.message || err.error_description || err.msg)) || err || "");
    if (/invalid login credentials/i.test(m)) return "Wrong email or password.";
    if (/email not confirmed/i.test(m)) return "This email is not confirmed yet.";
    if (/already registered|already been registered/i.test(m)) return "This email already has an account.";
    if (/password should be at least|weak.?password/i.test(m)) return "Choose a longer password.";
    if (/should be different from the old password/i.test(m)) return "Choose a password you have not used here before.";
    if (/token has expired or is invalid|otp.?expired|invalid.*otp/i.test(m)) return "That code is not right, or it is too old. Ask for a new email.";
    if (/only request this after/i.test(m)) return "Wait a minute before asking for another email.";
    if (/email address.*(not authorized|is invalid)|error sending/i.test(m)) return "We can't send email to this address yet. Creating accounts opens to everyone soon.";
    if (/signups? (not allowed|disabled)/i.test(m)) return "Creating accounts is switched off for now.";
    if (/rate limit|too many/i.test(m)) return "Too many tries. Wait a minute and try again.";
    if (/failed to fetch|networkerror|load failed/i.test(m)) return "Can't reach the server. Check your connection and try again.";
    if (/jwt|not authenticated|401/i.test(m)) return "You are signed out. Sign in again.";
    if (/payload too large|exceeded the maximum allowed size|413/i.test(m)) return "The file is too big for the server.";
    return m || "Something went wrong. Please try again.";
  }
  async function refresh(session) {
    const u = session && session.user ? session.user : null;
    B.user = u ? { id: u.id, email: u.email || "" } : null; B.role = ""; B.name = ""; B.premium = false;
    if (u) {
      try {
        const r = await client.rpc("my_profile");
        if (!r.error && r.data) { B.role = String(r.data.role || "listener"); B.name = String(r.data.display_name || ""); B.premium = !!r.data.premium; }
      } catch (e) {}
    }
    B.ready = true; notify();
  }

  /* Start the account layer (loads the library once). Safe to call many times. */
  B.init = function () {
    if (!enabled) return Promise.resolve(null);
    if (!initP) initP = lib().then(async () => {
      client = window.supabase.createClient(url, key, {
        auth: { persistSession: true, storage: shared ? memStore : undefined, storageKey: "velora_auth", autoRefreshToken: true, detectSessionInUrl: false }
      });
      const got = await client.auth.getSession();
      await refresh(got && got.data ? got.data.session : null);
      // Never call the server from inside this callback (the library would wait on itself): defer it.
      client.auth.onAuthStateChange((ev, session) => { if (ev === "SIGNED_OUT" || ev === "SIGNED_IN" || ev === "USER_UPDATED") setTimeout(() => refresh(session), 0); });
      return client;
    }).catch(e => { initP = null; B.ready = true; throw new Error(plain(e)); });
    return initP;
  };
  B.onChange = f => { subs.push(f); };
  B.remembered = remembered;
  B.canUpload = () => B.role === "owner" || B.role === "creator";

  const fail = (e, code) => { const x = new Error(plain(e)); if (code) x.code = code; return x; };
  const unconfirmed = e => !!e && (e.code === "email_not_confirmed" || /email not confirmed/i.test(e.message || ""));
  const here = () => location.origin + location.pathname;            // where links in emails come back to
  const mail = v => String(v || "").trim();

  B.signIn = async function (email, password) {
    await B.init();
    const r = await client.auth.signInWithPassword({ email: mail(email), password: String(password || "") });
    if (r.error) throw fail(r.error, unconfirmed(r.error) ? "unconfirmed" : "");
    await refresh(r.data ? r.data.session : null);
    return B.user;
  };

  /* Create an account. Answers "in" (signed in at once), "confirm" (an email is on its way) or "exists". */
  B.signUp = async function (o) {
    await B.init();
    const r = await client.auth.signUp({ email: mail(o.email), password: String(o.password || ""), options: { data: { display_name: String(o.name || "").trim().slice(0, 80) }, emailRedirectTo: here() } });
    if (r.error) throw fail(r.error);
    const u = r.data && r.data.user, s = r.data && r.data.session;
    if (s) { await refresh(s); return "in"; }
    if (u && Array.isArray(u.identities) && !u.identities.length) return "exists";
    return "confirm";
  };
  /* The code from the confirmation email (for emails that show one; the link in the email does the same). */
  B.confirmEmail = async function (email, code) {
    await B.init();
    let r = await client.auth.verifyOtp({ email: mail(email), token: mail(code), type: "signup" });
    if (r.error) r = await client.auth.verifyOtp({ email: mail(email), token: mail(code), type: "email" });
    if (r.error) throw fail(r.error);
    await refresh(r.data ? r.data.session : null); return B.user;
  };
  B.resend = async function (email) { await B.init(); const r = await client.auth.resend({ type: "signup", email: mail(email), options: { emailRedirectTo: here() } }); if (r.error) throw fail(r.error); };
  B.sendReset = async function (email) { await B.init(); const r = await client.auth.resetPasswordForEmail(mail(email), { redirectTo: here() }); if (r.error) throw fail(r.error); };
  B.resetWithCode = async function (email, code, password) {
    await B.init();
    const r = await client.auth.verifyOtp({ email: mail(email), token: mail(code), type: "recovery" });
    if (r.error) throw fail(r.error);
    const u = await client.auth.updateUser({ password: String(password || "") });
    if (u.error) throw fail(u.error);
    await refresh(r.data ? r.data.session : null); return B.user;
  };
  B.setPassword = async function (password) { await B.init(); const r = await client.auth.updateUser({ password: String(password || "") }); if (r.error) throw fail(r.error); };
  B.setName = async function (name) { const d = await B.rpc("set_my_name", { p_name: String(name || "").trim() }); B.name = String(d || name || ""); notify(); return B.name; };
  B.deleteAccount = async function () { await B.rpc("delete_my_account"); try { await client.auth.signOut({ scope: "local" }); } catch (e) {} await refresh(null); };

  /* Arriving from a link in an email (confirm the address, or reset the password): the address then carries the
     sign-in after "#", where the pages normally live. Take it over, clean the address, and say what the link was for. */
  B.linkInAddress = () => !/^#\//.test(location.hash) && /(^#|&)(access_token|error_description|error_code)=/.test(location.hash);
  B.fromLink = async function () {
    if (!enabled || !B.linkInAddress()) return null;
    const p = new URLSearchParams(location.hash.slice(1)), out = { type: p.get("type") || "", error: "" };
    try { history.replaceState(null, "", location.pathname + location.search + "#/account"); } catch (e) { location.hash = "#/account"; }
    const bad = (p.get("error_description") || "") + " " + (p.get("error_code") || "");
    if (bad.trim()) { out.error = /expired|invalid|denied/i.test(bad) ? "That link is too old or was already used. Ask for a new email." : plain(p.get("error_description")); return out; }
    try {
      await B.init();
      const r = await client.auth.setSession({ access_token: p.get("access_token") || "", refresh_token: p.get("refresh_token") || "" });
      if (r.error) { out.error = plain(r.error); return out; }
      await refresh(r.data ? r.data.session : null);
    } catch (e) { out.error = plain(e); }
    return out;
  };
  B.signOut = async function () {
    if (client) { try { await client.auth.signOut(); } catch (e) {} }
    if (client) await refresh(null);
  };
  /* One-time owner setup: creates the owner's account. Needs the setup code (see docs/UPLOAD-STUDIO.md). */
  B.ownerSetup = async function (body) {
    let r, j = {};
    try { r = await fetch(url + "/functions/v1/owner-setup", { method: "POST", headers: { "Content-Type": "application/json", apikey: key }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error(plain(e)); }
    try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j.ok) throw new Error(j.error || "The setup did not work (" + r.status + ").");
    return j;
  };

  /* Call a server function (see supabase/schema.sql). Throws a plain-language error. */
  B.rpc = async function (fn, args) {
    await B.init();
    const r = await client.rpc(fn, args || {});
    if (r.error) throw new Error(plain(r.error));
    return r.data;
  };
  /* A public server function, for every visitor: one small request, no sign-in and no library. */
  B.open = async function (fn, args) {
    if (!enabled || !/^[a-z_]{3,40}$/.test(fn)) throw new Error("Not available.");
    let r; try { r = await fetch(url + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: key, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(args || {}) }); }
    catch (e) { throw new Error(plain(e)); }
    if (!r.ok) throw new Error("The server did not answer (" + r.status + ").");
    return r.json();
  };
  /* The published songs and their artists, for every visitor. One small request, no library needed. */
  B.catalogue = async function () {
    if (!enabled) return null;
    const r = await fetch(url + "/rest/v1/rpc/public_catalogue", { headers: { apikey: key, Accept: "application/json" } });
    if (!r.ok) throw new Error("catalogue " + r.status);
    const d = await r.json();
    // The server answers with storage paths; the site needs full addresses.
    if (d && Array.isArray(d.songs)) d.songs.forEach(s => { if (s) { if (typeof s.audio === "string") s.audio = B.mediaUrl(s.audio); if (typeof s.art === "string") s.art = B.mediaUrl(s.art); } });
    if (d && Array.isArray(d.artists)) d.artists.forEach(a => { if (a && typeof a.image === "string") a.image = B.mediaUrl(a.image); });
    return d;
  };
  /* Public address of a stored file, and its storage path back from that address. */
  B.mediaUrl = path => url + "/storage/v1/object/public/media/" + String(path).split("/").map(encodeURIComponent).join("/");
  B.isMediaUrl = u => typeof u === "string" && u.indexOf(url + "/storage/v1/object/public/media/") === 0;
  /* Store a file in the signed-in uploader's own folder. Returns its public address. */
  B.upload = async function (path, blob, type) {
    await B.init();
    // Files are named after their own fingerprint and are never replaced. "Already there" on a second try means the same file is in place.
    const r = await client.storage.from("media").upload(path, blob, { contentType: type, upsert: false, cacheControl: "31536000" });
    const e = r.error, there = e && (String(e.statusCode) === "409" || e.status === 409 || /already exists|duplicate/i.test((e.message || "") + " " + (e.error || "")));
    if (e && !there) throw new Error(plain(e));
    return B.mediaUrl(path);
  };
  B.licenses = async function () { try { const d = await B.rpc("my_licenses"); return Array.isArray(d) ? d : []; } catch (e) { return []; } };

  /* ---------- The shop (payments). Everything here stays quiet while the shop is closed on the server. ---------- */
  /* Is the shop open, and what does the server charge (in cents)? Asked once per visit; null when it can't be reached. */
  let shopP = null;
  B.shop = function () {
    if (!enabled) return Promise.resolve(null);
    if (!shopP) shopP = B.open("shop_info").then(d => (d && typeof d === "object" ? d : null)).catch(() => { shopP = null; return null; });
    return shopP;
  };
  /* Start a payment: { kind: "rent" | "buy", song_id, song_title, buyer_name, consent: true } or { kind: "premium" };
     { kind: "manage" } opens the provider's page where a member cancels Premium. Answers the address of the provider's page.
     The error carries code "closed" (payments are off) or "account" (sign in first). */
  B.checkout = async function (body) {
    const headers = { "Content-Type": "application/json", apikey: key };
    if (client) { try { const g = await client.auth.getSession(), t = g && g.data && g.data.session && g.data.session.access_token; if (t) headers.Authorization = "Bearer " + t; } catch (e) {} }
    let r, j = {};
    try { r = await fetch(url + "/functions/v1/checkout", { method: "POST", headers, body: JSON.stringify(Object.assign({ return_url: here() }, body)) }); }
    catch (e) { throw new Error(plain(e)); }
    try { j = (await r.json()) || {}; } catch (e) {}
    if (j.closed) throw fail("Payments are not open yet.", "closed");
    if (j.needAccount) throw fail(j.error || "Sign in first.", "account");
    // Only the provider's own https address (or, in the tests, the stand-in on this computer) is followed.
    const okUrl = local ? /^http:\/\/(localhost|127\.0\.0\.1):\d+\// : /^https:\/\//;
    if (!r.ok || !j.ok || !okUrl.test(String(j.url || ""))) throw new Error(j.error || "The payment could not be started (" + r.status + ").");
    return j.url;
  };
  /* The license of a finished payment (null while the provider's message is still on its way). */
  B.claim = ref => B.open("claim_purchase", { p_ref: String(ref || "") });
  /* What the public register says about a license number (null = unknown). */
  B.verify = id => B.open("verify_license", { license_id: String(id || "") });
  /* Premium member: the certificate for one song. */
  B.premiumLicense = (song, title) => B.rpc("premium_license", { p_song: String(song || ""), p_title: String(title || "") });
  /* Licenses bought without signing in, paid with this account's confirmed email, move into the account. */
  B.linkPurchases = async function () { try { return Number(await B.rpc("link_my_purchases")) || 0; } catch (e) { return 0; } };
  /* Read the profile again (after a payment, Premium may have just started). */
  B.reload = async function () { await B.init(); const got = await client.auth.getSession(); await refresh(got && got.data ? got.data.session : null); return B; };
  return B;
})();
