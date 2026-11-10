/* Velora accounts (optional). OFF until config.js has a Supabase address and public key.
   Sign-in is by email link: no passwords are stored anywhere.
   This file only reads what the database rules (supabase/schema.sql) allow the signed-in person to see.
   NOT YET TESTED against a live project: test sign-in, sign-out and the rules before switching it on. */
(function () {
  "use strict";
  const cfg = (window.VELORA_CONFIG || {}).supabase || {};
  const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url || "") && typeof cfg.anonKey === "string" && cfg.anonKey.length > 20;
  const listeners = new Set();
  let client = null, session = null, premium = false, ready = null;

  const emit = () => listeners.forEach(f => { try { f(Account); } catch (e) { /* a listener must never break sign-in */ } });
  const loadScript = src => new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load")); document.head.appendChild(s);
  });

  async function refresh() {
    premium = false;
    if (!session) return;
    const { data } = await client.from("entitlements").select("premium_until").eq("user_id", session.user.id).maybeSingle();
    premium = !!(data && data.premium_until && new Date(data.premium_until) > new Date());
  }
  function init() {
    if (!enabled) return Promise.resolve(Account);
    if (!ready) ready = (async () => {
      await loadScript("vendor/supabase.js"); // self-hosted copy, so no third-party script runs on the site
      client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
      const { data } = await client.auth.getSession();
      session = data.session; await refresh();
      client.auth.onAuthStateChange((_event, s) => { session = s; refresh().then(emit, emit); });
      return Account;
    })();
    return ready;
  }
  async function signIn(email) {
    await init();
    email = String(email || "").trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Please enter a valid email address.");
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    // One neutral message for every failure, so the form never reveals whether an address is registered.
    if (error) throw new Error("We couldn't send the email. Please try again in a minute.");
  }
  async function signOut() { if (client) await client.auth.signOut(); }
  async function licenses() {
    if (!client || !session) return [];
    const { data, error } = await client.from("licenses").select("id,song_id,type,issued_at,valid_until").order("issued_at", { ascending: false });
    return error || !Array.isArray(data) ? [] : data;
  }

  const Account = {
    enabled,
    get user() { return session ? session.user : null; },
    get premium() { return premium; },
    onChange(f) { listeners.add(f); },
    init, signIn, signOut, licenses
  };
  window.VeloraAccount = Account;
})();
