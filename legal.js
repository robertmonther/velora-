/* Velora: the legal pages (terms of use, license terms, terms of sale, privacy, who we are, content rules).
   Loaded only when someone opens one of them.

   IMPORTANT: these texts are DRAFTS written on 11 Nov 2026 by Claude, who is not a lawyer. They follow Dutch and
   EU rules as far as we could check, and they must be reviewed by a lawyer before the site sells anything.
   Business details come from config.js (business); prices from config.js (prices). docs/LEGAL.md lists what is open. */
(function () {
  "use strict";
  const DATE = "11 November 2026";
  const PAGES = [
    ["/terms", "Terms of use", "The rules for listening, accounts and uploading."],
    ["/license", "License terms", "What you may do with a song you rent, buy or get with Premium."],
    ["/sales", "Terms of sale", "Paying, delivery, your right to withdraw, refunds."],
    ["/privacy", "Privacy policy", "What we know about you, why, and your rights."],
    ["/content", "Content rules, AI and reports", "What is on Velora, how AI is used, how to report a song."],
    ["/imprint", "Who we are", "The business behind Velora and how to reach it."]
  ];

  function build(ctx) {
    const C = ctx.CFG || {}, B = C.business || {}, P = C.prices || {}, name = C.siteName || "Velora";
    const who = B.name || ctx.creator, mail = B.email || "", soon = "(listed here before sales open)";
    const contact = mail ? mail : "the contact address on the page “Who we are”";
    const price = k => (P[k] && P[k].price) || "";
    const minAge = (C.accounts && C.accounts.minAge) || 16;
    return {
      "/terms": [
        ["1. Who we are", [`${name} is run by ${who}, ${B.country || "the Netherlands"}. Full business details are on the page “Who we are”.`]],
        ["2. What Velora is", [`${name} is a music library. You can listen to whole songs, and you can get a license to use a song in your own content. The songs are AI-assisted: see “Content rules, AI and reports”.`]],
        ["3. Listening", ["Listening is free and needs no account.", ["Listening is for your personal use.", "Do not download, record, copy or re-upload the songs, the covers or the lyrics, and do not get around the technical protection.", "Do not use the songs, lyrics or covers to train or test AI systems, or to copy a voice.", "Do not collect the catalogue with automated tools."], "To use a song in a video, a podcast, an ad or anything else you publish, you need a license: see “License terms”."]],
        ["4. Explicit songs", ["Some songs have explicit lyrics. They carry an “E” badge. You can hide them on your device in Settings."]],
        ["5. Your account", [`You can create an account if you are ${minAge} or older.`, ["Give your real email address and keep your password to yourself.", "One account is for one person.", "You can delete your account at any time in “Your account”. Licenses you bought stay valid."], "We may pause or close an account that breaks these terms. We tell you why, and you can answer."]],
        ["6. Uploading songs", ["Uploading is open to accounts we have approved.", ["You upload only songs you made or own all rights to: the recording, the lyrics and the cover.", "No covers of other people's songs, no samples without permission, no imitation of a real person's voice.", "You say truthfully whether AI was used and what it made.", "You stay the owner. You give us the permission to store, stream, show and promote the song on Velora, and to license it to others on the terms you choose, for as long as it is listed.", "You are responsible for what you upload. If someone makes a justified claim against a song, we may take it off the list."], "On publishing we write a dated ownership record with fingerprints of your files. It is evidence of what was uploaded and when. It is not a copyright registration."]],
        ["7. What we promise, and what we do not", [`We run ${name} with care, but it can be unavailable for a while, and songs can be removed. We are liable for damage we cause on purpose or through gross negligence, and for what the law does not allow us to exclude. For other damage our liability is limited to what you paid us in the twelve months before.`, "Nothing in these terms takes away rights that the law of your country gives you as a consumer."]],
        ["8. Changes", ["We may change these terms. For changes that matter we tell account holders by email at least 30 days before. If you do not agree you can close your account."]],
        ["9. Law and complaints", [`Dutch law applies. If you are a consumer, you keep the protection of the mandatory rules of the country where you live, and you can go to the court there.`, `Complaints: write to ${contact}. We answer within 14 days.`]]
      ],
      "/license": [
        ["1. The idea", [`A license is our permission to use a song in content you publish. The song itself stays ours (or its creator's). Every license has a certificate with a number that anyone can check on the “Verify a license” page.`, "Unless it says “exclusive”, a license is not exclusive: other people can license the same song."]],
        ["2. The licenses", [[`Rent${price("rent") ? " (" + price("rent") + ")" : ""}: one song in one piece of content on one channel. You publish it within 30 days of paying. Once it is published in time, it may stay online for good.`, `Buy${price("buy") ? " (" + price("buy") + ")" : ""}: one song in as many pieces of content as you like, on all your own channels, for life. One buyer: one person or one business.`, `Premium${price("sub") ? " (" + price("sub") + " a month)" : ""}: every song in the library, in content you publish on your own channels while you are subscribed. What you published during the subscription stays licensed after it ends. New content needs an active subscription.`, "Exclusive: by written agreement only. The song then leaves the library."]]],
        ["3. What is included", [["Online use: social media, video platforms, podcasts, websites, online ads for your own brand, client work that you deliver once.", "Editing the song to fit: cutting, looping, fading, talking over it.", "Earning money with your content."]]],
        ["4. What is not included", [["Selling or sharing the song by itself, as a file or on a streaming service, also when edited.", "Sub-licensing, or putting the song in a library, template or product that others re-use.", "Registering the song, or content made mainly of it, with Content ID, a collecting society or any rights system, or claiming you wrote it.", "Television, cinema and radio broadcast, games and apps, physical products: ask us first.", "Training or testing AI systems, or copying the voice.", "Content that is unlawful, hateful, sexually explicit or defamatory, or that suggests the artist supports a political party, a religion or a product."]]],
        ["5. Credit", ["A credit is welcome and not required: “Music: [song] by [artist], licensed from " + name + "”."]],
        ["6. About the music", ["The songs are AI-assisted: the music and the voices are made with an AI music tool, and the lyrics and the song design are written by a person. We have the right to license the songs for commercial use. In many countries music made with AI has limited or no copyright protection, so we cannot promise that nobody else may use similar music."]],
        ["7. If something goes wrong", ["If you break this license it ends, and you take the content down. If we must withdraw a song for a legal reason, we tell you; you stop using it in new content and we give you another song or your money back for that license."]]
      ],
      "/sales": [
        ["1. Seller", [`${who}, ${B.country || "the Netherlands"}. Trade register and VAT numbers: see “Who we are”.`]],
        ["2. Prices and paying", ["Prices are in euros and include VAT. You pay through our payment provider; we never see your card or bank details. You get a confirmation by email."]],
        ["3. Delivery", ["Licenses are digital. Right after payment you see the license certificate with its number and you can download the song file. If you have an account, or create one later with the email address you paid with, your licenses are listed there."]],
        ["4. Your right to withdraw (consumers in the EU)", ["For 14 days after an online purchase you can withdraw without giving a reason.", ["A song license with its file (digital content): we deliver at once. Before you pay we ask you to agree that delivery starts immediately and that you lose the right to withdraw once it has started. You tick that box yourself.", "Premium (a subscription): you can withdraw within 14 days of the first payment. If you asked us to start at once, you pay only for the days until you withdrew."], `To withdraw, write to ${contact} with your name, the date and what you bought. We confirm at once and pay back within 14 days, the way you paid.`]],
        ["5. Premium", ["Premium renews every month until you cancel. You can cancel at any time in your account; it then runs to the end of the month you paid for."]],
        ["6. If a file is faulty", ["If a file does not play or is not what was described, tell us. We fix or replace it, or pay you back. Your legal rights stay as they are."]],
        ["7. Complaints", [`Write to ${contact}. We answer within 14 days.`]]
      ],
      "/privacy": [
        ["1. Who is responsible", [`${who}, ${B.country || "the Netherlands"} (contact: ${contact}).`]],
        ["2. In short", [["Listening needs no account, and we do not track you.", "No advertising cookies, no analytics, no selling of data.", "We keep only what an account, a purchase or an upload needs."]]],
        ["3. What we keep, and why", [["Without an account: nothing about you on our side. Your browser remembers, on your device only, the songs you played recently, your settings and the numbers of licenses bought on it. You can clear that in Settings.", "Account: your email address, your name and a protected form of your password (we cannot read it). Needed to run your account (contract).", "Purchases: your name, email, what you bought, the amount, the license number, a payment reference and the time you agreed to immediate delivery. Needed for the contract and for the tax records the law makes us keep for seven years.", "Uploads: the song, cover, lyrics, credits, and the ownership record with your name, the time and file fingerprints. Needed to publish the song and to keep the record (contract and our legitimate interest in proof of origin).", "Messages you send us: to answer you."]]],
        ["4. Who helps us", [["Supabase: accounts, database and file storage, in the European Union (Frankfurt).", "Our web host: delivers the pages and files, and sees your IP address while doing so.", "Our payment provider: handles the payment and its own fraud checks."], "They work on our instructions. We do not send your data to anyone else, unless the law makes us."]],
        ["5. How long", ["Account data: until you delete your account. Purchase records: seven years. Ownership records: as long as the song has been published, and after, as proof. Messages: two years."]],
        ["6. Your rights", ["You can ask what we hold about you, have it corrected or deleted, limit or object to its use, and get a copy to take elsewhere. Write to us; we answer within a month. You can also complain to the Dutch data protection authority (Autoriteit Persoonsgegevens) or the authority in your country."]],
        ["7. Age", [`Accounts are for people of ${minAge} and older.`]]
      ],
      "/content": [
        ["1. AI and the music on Velora", ["The songs are AI-assisted, and we say so on every song: under “Credits” you see who wrote the lyrics, who produced the song and what the AI made (music, voice, lyrics or cover) and with which tool."]],
        ["2. Explicit songs", ["Songs with explicit lyrics carry an “E” badge. Covers show no nudity. You can hide explicit songs on your device in Settings."]],
        ["3. What may not be on Velora", [["Songs, lyrics or covers that belong to someone else, including covers and samples without permission.", "Imitations of a real person's voice or likeness without that person's permission.", "Anything sexual that involves minors, in any form. We remove it and report it.", "Hate, threats, harassment, or calls for violence.", "Anything else that is against the law."]]],
        ["4. Report a song", [`If you think a song on ${name} breaks these rules or your rights, write to ${contact} with: the song's page address, what is wrong, and who you are. If it is about your own work, add where the original can be found.`, "We read every report, decide without delay, and tell you and the uploader what we decided and why. The uploader can answer. Whoever keeps breaking the rules loses the right to upload."]],
        ["5. The ownership record", ["Each uploaded song has a public record with the date and fingerprints of its files. It shows who published what and when. It does not decide who is right in a dispute."]]
      ],
      "/imprint": [
        ["The business", [[`Name: ${B.name || who + " " + soon}`, `Legal form: ${B.legalForm || soon}`, `Address: ${B.address || soon}`, `Trade register (KVK): ${B.kvk || soon}`, `VAT number: ${B.vat || soon}`, `Email: ${mail || soon}`]]],
        ["Reports and authorities", [`Reports about content, and messages from authorities, go to the same address. We answer in English, Dutch or Arabic.`]]
      ]
    };
  }

  window.VeloraLegal = {
    pages: PAGES,
    open(path, ctx) {
      const esc = ctx.esc, m = ctx.main, name = (ctx.CFG && ctx.CFG.siteName) || "Velora";
      const nav = `<nav class="legalnav" aria-label="Legal pages">${PAGES.map(p => `<a href="#${p[0]}"${p[0] === path ? ' aria-current="page"' : ""}>${esc(p[1])}</a>`).join("")}</nav>`;
      if (path === "/legal" || !PAGES.some(p => p[0] === path)) {
        m.innerHTML = `<h1 class="pagetitle">Legal</h1><p class="muted">The rules of ${esc(name)}, in plain words.</p>
          <div class="legallist">${PAGES.map(p => `<a class="panel legalcard" href="#${p[0]}"><b>${esc(p[1])}</b><span class="muted small">${esc(p[2])}</span></a>`).join("")}</div>`;
        return;
      }
      const page = PAGES.find(p => p[0] === path), body = build(ctx)[path];
      const part = x => Array.isArray(x) ? `<ul>${x.map(li => `<li>${esc(li)}</li>`).join("")}</ul>` : `<p>${esc(x)}</p>`;
      m.innerHTML = `<article class="legal"><h1 class="pagetitle">${esc(page[1])}</h1>
        <p class="legalnote" role="note">Draft of ${DATE}. It becomes final when the business is registered and a lawyer has reviewed it.</p>
        ${body.map(s => `<section><h2>${esc(s[0])}</h2>${s[1].map(part).join("")}</section>`).join("")}${nav}</article>`;
    }
  };
})();
