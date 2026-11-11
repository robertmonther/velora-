# Legal pages: what is drafted, what is open

Written 11 Nov 2026. **These are drafts by Claude, who is not a lawyer.** They are a starting point for a lawyer's review, not legal advice. Nothing here is final until the business is registered and a lawyer has read the texts.

## Where things are

- The texts: `legal.js` (loaded only when a legal page is opened). Pages: `#/legal` (list), `#/terms`, `#/license`, `#/sales`, `#/privacy`, `#/content`, `#/imprint`.
- Business details (name, legal form, address, KVK, VAT, email): `config.js → business`. Empty today; the pages then say "listed here before sales open".
- Prices shown in the license terms come from `config.js → prices` (still example prices).
- Creating an account asks for agreement to the Terms of use and the Privacy policy. Checkout asks for the withdrawal consent (see below).
- Links: the menu ("Terms and privacy") and the footer.

## Choices baked into the drafts (Proposals: Robert decides)

| Topic | Draft says |
| --- | --- |
| Rent | One song, one piece of content, one channel, published within 30 days; then it may stay online for good |
| Buy | One song, unlimited content on the buyer's own channels, for life, one buyer, not exclusive |
| Premium | Whole library while subscribed; content published during the subscription stays licensed |
| Exclusive | By written agreement only; the song leaves the library |
| Not included in any license | Selling the song itself, sub-licensing, Content ID or collecting-society registration, TV/cinema/radio, games and apps, AI training, unlawful or hateful or sexually explicit content, implied endorsement |
| Accounts | From 16 years |
| Law | Dutch law; consumers keep the mandatory protection of their own country |
| Liability | Limited to what the customer paid in the last twelve months, except intent, gross negligence and what the law forbids to exclude |

## Rules the drafts follow (with where we read them)

- **Right to withdraw, digital content.** A consumer loses the 14-day right only if three things are true: delivery started with their prior express consent, they acknowledged losing the right, and the seller confirmed the contract (in practice: an email). A statement next to the Pay button is not enough; the customer must tick it. Read at lawwwing.com/en/withdrawal-button-subscriptions and docs.mageme.com/eu-withdrawal/digital-content-waiver, and a German court case described at osborneclarke.com/insights/withdrawal-right. The checkout has one unticked box with both statements, and the server stores the time of that consent with the license.
- **Subscriptions** keep the 14-day right even when used; the customer pays for the days used (same lawwwing.com page). **To check:** the EU's new "withdrawal function" for online contracts (Directive 2023/2673, described at iubenda.com) and whether a button is needed for Premium.
- **AI labelling (EU AI Act, Article 50).** In force since 2 August 2026. The duty to mark AI output in a machine-readable way sits with the *provider* of the AI system (here: the music tool), with time until 2 December 2026 for systems already on the market. *Deployers* must disclose deep fakes and AI-written public-interest text. Read at ictrecht.nl, mccannfitzgerald.com and casrai.org. Velora discloses on every song what the AI made. **To check with the lawyer:** the Commission reads "deep fake" broadly (reedsmith.com); does a synthetic singing voice that imitates nobody count?
- **Payment provider and explicit songs.** Stripe does not work with businesses that sell adult content (support.stripe.com, "Prohibited and Restricted Businesses List: FAQs"). Songs with explicit lyrics are music, not pornography, but **ask the provider in writing before relying on it**, with a link to the catalogue.
- **Privacy (GDPR).** The privacy page names what is kept, why, who helps (Supabase in Frankfurt, the web host, the payment provider), how long, and the rights, including a complaint to the Autoriteit Persoonsgegevens.

## Before sales open: legal checklist

1. Register the business; fill `config.js → business`.
2. A lawyer reviews the six pages (bring the questions below).
3. The payment provider confirms in writing that the catalogue is fine for them.
4. A contact email that is read, for complaints, withdrawals and reports.
5. Prices final, including VAT; invoices (ask the accountant: VAT on digital sales to other EU countries).
6. The confirmation email after a purchase repeats the withdrawal consent.
7. When other creators can upload (phase 2): terms for creators, a report form with a written decision each time, a way for the uploader to answer, and a rule for repeat offenders (EU Digital Services Act).

## Questions for the IP lawyer (one session)

1. **What do I own?** The music and voices come from Suno, the lyrics and song design are mine. In the Netherlands and the EU, what protection does each song have, and how should the license terms say it?
2. **Suno's terms.** I get commercial-use rights for songs made and downloaded while subscribed. Does that cover licensing the songs to other people (rent, buy, subscription) and granting an exclusive license?
3. **Songs close to other works.** Count to Three, If We Burn, The Skeleton Key and Lose Our Fear follow the shape and some phrases of "The Hanging Tree"; Obey Me uses the line "Every breath you take, every move you make". Safe to license, or change first?
4. **The license terms.** Are the four licenses clear and enforceable? Is the promise in "About the music" right, and the liability limit?
5. **The ad.** "No more DistroKid. No more LANDR. No waiting in line for Spotify. No MusixMatch for lyrics…": may I name these companies (comparative advertising), and may I say "distribute" when the site streams the songs itself and does not deliver them to stores?
6. **The platform (phase 2).** When other creators upload: what must the site do (reports, decisions, repeat offenders), what am I liable for, and what must creators agree to?
7. **Proof.** How much is the site's dated ownership record worth as evidence? Should I add i-DEPOT, and register the lyrics with BumaStemra?
8. **AI labelling.** Is a synthetic singing voice a "deep fake" under Article 50 of the AI Act? Is the disclosure under "Credits" enough?
9. **Explicit songs and sensual covers.** Any age-related duty for a music site in the Netherlands or the EU? Anything to watch for the app stores?
10. **Withdrawal.** Is one tick box with both statements enough for song licenses? Do I need a "withdraw" button for Premium?
