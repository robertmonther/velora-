# Payments: built, tested, switched off

Status on 12 November 2026: everything below is in place and checked. **Nothing can be paid yet.** The shop is
closed on the server and no payment-provider key exists anywhere. Opening it is a short list at the end of this page.

## What a buyer does

1. Opens a song and taps **License**. Chooses Rent, Buy or Premium.
2. Rent or Buy: ticks one box ("Deliver my license right after I pay. I understand that I then lose my 14-day right
   to withdraw.") and taps **Pay**. The name on the license is optional; without one the license takes the name the
   buyer pays with.
3. Pays on the payment provider's own page (iDEAL, card and so on). The site never sees card or bank details.
4. Comes back to the **Thank you** page. It shows the license certificate with its number, a button to download the
   song, a link to check the number, and "Print or save as PDF".
5. Anyone can check the number on **Verify a license**. The register answers: valid, refunded, or (for a Premium
   license) membership ended.

No account is needed to rent or buy. A buyer who later creates an account with the email address they paid with
finds those licenses in the account. Premium needs an account; a member gets the certificate of any song without
paying again, and cancels in the account ("Manage or cancel Premium" opens the provider's page).

## How it works

| Part | Where | What it does |
| --- | --- | --- |
| The shop row | database, `private.shop` | Open or closed, the currency, the three prices in cents, the rental days. The server charges these prices; the site only shows them. |
| `checkout` | Supabase Edge Function | Checks the request, reads the price from the shop row, creates the checkout page at the provider, answers with its address. Also opens the provider's "manage Premium" page for a member. |
| `payment-webhook` | Supabase Edge Function | The provider calls it after a payment. It accepts only messages with the right signature, then asks the database to write the license or the Premium time. |
| `record_purchase`, `record_premium`, `record_refund` | database functions, server key only | Write one license per payment (the same payment told twice gives the same license), keep Premium running month by month, mark a refunded license. |
| `claim_purchase`, `verify_license`, `shop_info` | database functions, public | Show the license of a finished payment to the buyer who comes back with the provider's reference, answer the Verify page, tell the site whether the shop is open. |
| `link_my_purchases`, `premium_license`, `my_licenses` | database functions, signed in | Move licenses bought with my email into my account, give a member a certificate, list my licenses. |

Rules that hold on the server, whatever a browser sends:

- A price never comes from the browser.
- A rent or buy without the delivery consent is refused; the time of the consent is stored with the license.
- The buyer can only be sent back to the site's own addresses (`SITE_ORIGINS`).
- A license can only be written with the server's own key, which lives in Supabase and nowhere else.
- A payment message without a valid signature, or older than five minutes, is refused.
- The certificate of an uploaded song carries the catalogue's own title, not the one the browser sent.

What a license stores: its number, the song, the type, the name on the license, what it covers, the dates, the
status, and for our records the buyer's email, the amount, the provider's references and the consent time. The
public register shows only what a certificate shows (never the email or the amount).

## Three states of the site

| Shop on the server | `demo` in config.js | What the License button does |
| --- | --- | --- |
| closed | `true` (today) | The demo: nothing is charged, an example certificate that says so. |
| closed | `false` | "Licensing opens soon." |
| open | either | The real payment. The demo banner and every "(demo)" label disappear, and prices come from the server. |

## The provider

The code talks to **Stripe** (Checkout for the payment page, its customer portal for cancelling Premium).
Mollie is the Dutch alternative; switching would mean rewriting the two functions, not the site or the database.

| | Stripe (built) | Mollie (alternative) |
| --- | --- | --- |
| iDEAL | €0.29 per payment | €0.29 per payment |
| European cards | 1.5% + €0.25 | 1.8% + €0.25 |
| Monthly fee | none | none |
| Subscriptions | yes, with a ready-made page to cancel | yes, more to build |

Fees as found in November 2026 (Stripe: <https://stripe.com/en-nl/pricing>; Mollie: its pricing page and 2026
reviews). Check both providers' own pricing pages before opening.

**To check before opening (in writing, with the provider):** both providers refuse adult content. Stripe's list
names "pornography and other mature audience content (including literature, imagery, and other media) designed for
the purpose of sexual gratification", also when AI-generated
(<https://stripe.com/legal/restricted-businesses>). Mollie does not accept "any digital sexual or pornographic
content" (<https://help.mollie.com/hc/en-gb/articles/115000939369>). Songs with explicit or sensual lyrics are not
named on either list. Ask the provider whether they may be sold, and keep the answer. If the answer is no, the
explicit songs can stay free to hear and simply not be for sale.

## Still open

1. **VAT.** To check with the Belastingdienst or a bookkeeper: which VAT applies to digital sales to consumers in
   other EU countries, whether the small-business scheme (KOR) fits, and whether to switch on the provider's
   automatic tax calculation. The terms of sale say prices include VAT.
2. **The confirmation email.** The provider sends a receipt. The law also wants the seller to confirm the contract
   and the buyer's withdrawal consent by email. That email needs the site's own email sender (see `GO-LIVE.md`).
3. **The song file.** A license holder downloads the same MP3 that plays on the site. Voice-tagged previews and a
   separate clean file (Robert's listening model of 8 November) are not built: they need a second file per song and
   a decision on the voice tag.
4. **Exclusive rights** stay "on request" by email. No automatic sale.
5. **Refunds** are made by Robert in the provider's dashboard. A full refund marks the license as refunded by itself.

## Opening the shop (when the business exists)

Only Robert can do steps 1 to 3; they need his identity and bank account.

1. Register the business (KVK) and fill `business` in `config.js`. The legal pages then show who sells.
2. Open the provider account and finish its checks. Ask the adult-content question above.
3. In the provider's dashboard: create a webhook to
   `https://jbnburfenipnpruhqyst.supabase.co/functions/v1/payment-webhook` with these five messages:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`,
   `customer.subscription.deleted`, `charge.refunded`. Switch on the customer portal (cancelling at the end of the
   paid month) and email receipts.
4. In Supabase → Edge Functions → Secrets, add: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_ORIGINS`
   (the site's address, for example `https://example.com`), and `SITE_NAME` once the name is chosen.
5. Set the real prices and open the shop (SQL editor in Supabase):
   `update private.shop set rent_cents = 900, buy_cents = 4900, premium_cents = 1400, open = true;`
6. In `config.js` set `demo: false` and raise the `?v=` number in `index.html`.
7. Do one real payment of the smallest price, check the certificate and the Verify page, then refund it.

To close the shop again at any moment: `update private.shop set open = false;`. Members can still cancel.

## Checks

- `node --experimental-strip-types tests/payments_server.mjs`: 24 checks on the two server functions (their real
  code, with a stand-in for the network).
- `python3 tests/payments.py`: 26 checks in a real browser, from the License button to the certificate, against a
  stand-in server and a stand-in payment page. Pictures land in `tests/shots/payments/`.
- On the real database (12 November 2026): the functions were run in a test that was rolled back, and the two
  deployed functions were called once each. They answered "closed" and "bad signature", as they should.
