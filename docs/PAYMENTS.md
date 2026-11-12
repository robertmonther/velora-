# Payments: built, tested, switched off

Status on 12 November 2026: everything below is in place and checked. **Nothing can be paid yet.** The shop is
closed on the server and no payment-provider key exists anywhere. Opening it is a short list at the end of this page.

The same day, the requests our server sends and the messages it receives were also checked against Stripe's own test
account ("Robert sandbox", test money only). That check found one thing that would have stopped every payment; it is
fixed. See "The seller and VAT".

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
| `song_title`, `premium_customer` | database functions, server key only | The title of a song that may be sold; a member's customer number at the provider (for cancelling). |

Rules that hold on the server, whatever a browser sends:

- A price never comes from the browser.
- Only songs the server knows are sold (uploaded songs, and the list of bundled songs in `private.bundled_songs`), and a
  certificate always carries the catalogue's own title.
- A rent or buy without the delivery consent is refused; the time of the consent is stored with the license.
- The buyer can only be sent back to the site's own addresses (`SITE_ORIGINS`).
- A license can only be written with the server's own key, which lives in Supabase and nowhere else.
- A payment message without a valid signature, or older than five minutes, is refused.

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

## The seller and VAT

Found on Stripe's test account on 12 November 2026: new Stripe accounts have **Managed Payments** switched on by
default. With it, Stripe itself is the seller towards the buyer (a "merchant of record") and every product needs one
of Stripe's product tax codes. Our checkout sent no tax code, so Stripe refused it. The `checkout` function now says
on every checkout which of the two it wants, and the default is: **our own business is the seller**, as the legal
pages say. Nothing changes for a buyer.

Who sells is Robert's decision, with the bookkeeper and the lawyer. The three ways, all built and switchable without
touching code:

| | A. We sell, no tax automation (today's setting) | B. We sell, Stripe works out the VAT | C. Stripe sells (Managed Payments) |
| --- | --- | --- | --- |
| Seller on the receipt | Robert's business | Robert's business | Stripe's Link ("Sold through Link"); the bank statement starts with `LINK.COM*` |
| VAT | Ours to work out, declare and pay, also for buyers in other EU countries | Stripe calculates it per buyer country; we still register, declare and pay. Stripe collects nothing for a country until a tax registration is added there | Stripe calculates, collects and remits it, in more than 80 countries |
| Disputes, fraud checks, payment questions from buyers | Ours | Ours | Stripe's. Stripe may also refund a buyer by itself within 60 days in certain cases |
| Extra cost on top of the normal payment fees | none | Stripe Tax fee per transaction (to check on Stripe's pricing page) | reported as 3.5% of each payment (to check on Stripe's pricing page) |
| What it needs | nothing more | a product tax code per product, or a default one in Stripe's tax settings | Stripe's eligibility review; a product tax code per product; the legal pages rewritten (the seller changes); a custom checkout address is not possible |
| Switch | none | `STRIPE_AUTOMATIC_TAX=on` (+ tax codes) | `STRIPE_MANAGED_PAYMENTS=on` + the three tax codes |

Sources: Stripe's own pages on how Managed Payments works, who can use it and how to set it up
(<https://docs.stripe.com/payments/managed-payments/how-it-works>,
<https://docs.stripe.com/payments/managed-payments/eligibility>,
<https://docs.stripe.com/payments/managed-payments/set-up>), tax for digital products
(<https://docs.stripe.com/tax/digital-products>) and pricing (<https://stripe.com/pricing>). The 3.5% figure comes
from two comparison sites that quote Stripe's pricing page (May 2026); read the number on Stripe's own page before
deciding. The Netherlands is on Stripe's list of supported business countries for Managed Payments, and audio content
is a supported product kind. Stripe also asks that the seller holds all rights needed to distribute the product:
that is lawyer question 2 (Suno's terms) again.

**Tax codes: candidates, not decided.** A tax code is a tax classification, so it is Robert's to confirm with the
bookkeeper. These are the entries for digital audio on Stripe's list of codes that Managed Payments accepts
(<https://docs.stripe.com/payments/managed-payments/changelog>):

| Product | Candidate | Stripe's name for it |
| --- | --- | --- |
| Rent | `txcd_10401001` | Digital Audio Works - downloaded - non subscription - with limited rights |
| Buy | `txcd_10401100` | Digital Audio Works - downloaded - non subscription - with permanent rights |
| Premium | `txcd_10401200` | Digital Audio Works - streamed - subscription - with conditional rights |
| Premium (other candidate) | `txcd_10804010` | Digital Audio Works - bundle - downloaded with permanent rights and streamed - subscription - with conditional rights |

The switches are secrets of the Supabase project, next to the Stripe key: `STRIPE_MANAGED_PAYMENTS` (`off` is the
default, `on` makes Stripe the seller), `STRIPE_TAX_CODE_RENT`, `STRIPE_TAX_CODE_BUY`, `STRIPE_TAX_CODE_PREMIUM`, and
`STRIPE_AUTOMATIC_TAX` (`on` for way B). With Managed Payments on and a tax code missing, the function refuses the
payment itself and writes the reason in its log, instead of sending a request Stripe would refuse.

### What the test account confirmed (12 November 2026)

Stripe's test account for this project is set to the Netherlands and answers in interface version
`2026-08-26.dahlia`. No real money moved and no live key was used.

| Checked | Result |
| --- | --- |
| Checkout for rent (one payment) and for Premium (monthly), way A | accepted, with our fields (song, name, account, consent time) |
| The same without saying who sells | refused: "product tax code is required for Managed Payments". This is the fault that was fixed |
| Way C with the candidate tax codes, one payment and monthly | accepted |
| Way B without a tax code | refused: a tax code is needed in every line, or a default in the tax settings |
| Way B with a tax code | accepted |
| The message for a paid Premium month (`invoice.paid`) | carries the account and the end of the paid month where our webhook reads them |
| The message when a subscription ends (`customer.subscription.deleted`) | carries the account where our webhook reads it |
| The message for a full refund (`charge.refunded`) | carries the payment reference and "refunded: true" where our webhook reads them |
| The page to manage or cancel Premium | opens; Stripe's default settings cancel at the end of the paid month, which is what the terms say |

The three real messages are kept (with neutral ids) as a check in `tests/payments_server.mjs`.

Not checked, because it needs the Stripe key in Supabase and a browser: one test payment from the License button
through Stripe's page and back to the certificate on the deployed site. That is the first thing to do together
once the test key is entered (see "Opening the shop", step 4, with the test key first).

Also seen on the test account:

- **iDEAL is switched off** in its payment-method settings. In the real account: Settings → Payment methods →
  switch on iDEAL (and Wero). With way C the test account offered cards, and Bancontact for one-time payments.
- **Refunding a Premium month does not end Premium.** Cancel the subscription in Stripe as well; the message about
  the ended subscription then switches Premium off.
- **Left behind in the test account** by these checks: one test customer named "Shape check (delete me)", one
  archived test product, one cancelled test subscription with a refunded test payment of €14, and a few unpaid test
  checkout pages that expire by themselves after a day. All test mode; they can be deleted in the dashboard.

## Still open

1. **VAT.** To check with the Belastingdienst or a bookkeeper: which VAT applies to digital sales to consumers in
   other EU countries, whether the small-business scheme (KOR) fits, and which of the three ways in "The seller and
   VAT" to take. The terms of sale say prices include VAT; all three ways keep the shown price as the final price.
2. **The confirmation email.** The provider sends a receipt. The law also wants the seller to confirm the contract
   and the buyer's withdrawal consent by email. That email needs the site's own email sender (see `GO-LIVE.md`).
3. **The song file.** A license holder downloads the same MP3 that plays on the site. Voice-tagged previews and a
   separate clean file (Robert's listening model of 8 November) are not built: they need a second file per song and
   a decision on the voice tag.
4. **Exclusive rights** stay "on request" by email. No automatic sale.
5. **Refunds** are made by Robert in the provider's dashboard. A full refund marks the license as refunded by itself.
   A refunded Premium month needs the subscription cancelled as well (see above).

## Opening the shop (when the business exists)

Only Robert can do steps 1 to 3; they need his identity and bank account.

1. Register the business (KVK) and fill `business` in `config.js`. The legal pages then show who sells.
2. Open the provider account and finish its checks. Ask the adult-content question above.
3. In the provider's dashboard: create a webhook to
   `https://jbnburfenipnpruhqyst.supabase.co/functions/v1/payment-webhook` with these five messages:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`,
   `customer.subscription.deleted`, `charge.refunded`. Open the customer portal settings and save them once
   (cancelling at the end of the paid month), switch on email receipts, and switch on iDEAL under Payment methods.
4. In Supabase → Edge Functions → Secrets, add: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_ORIGINS`
   (the site's address, for example `https://example.com`), and `SITE_NAME` once the name is chosen. Only Robert
   can type these values: Supabase asks for them in its own dashboard and they never pass through Claude.
   The switches from "The seller and VAT" go in the same place, only if way B or C is chosen.
   A good first run: enter Stripe's **test** key and test webhook secret, open the shop, pay with Stripe's test card
   `4242 4242 4242 4242`, check the certificate, then close the shop again and swap in the live key when the
   business exists.
5. Set the real prices and open the shop (SQL editor in Supabase):
   `update private.shop set rent_cents = 900, buy_cents = 4900, premium_cents = 1400, open = true;`
6. In `config.js` set `demo: false` and raise the `?v=` number in `index.html`.
7. Do one real payment of the smallest price, check the certificate and the Verify page, then refund it.

To close the shop again at any moment: `update private.shop set open = false;`. Members can still cancel.

## Checks

- `node --experimental-strip-types tests/payments_server.mjs`: 32 checks on the two server functions (their real
  code, with a stand-in for the network), among them the three messages copied from Stripe's test account.
- `python3 tests/payments.py`: 27 checks in a real browser, from the License button to the certificate, against a
  stand-in server and a stand-in payment page. Pictures land in `tests/shots/payments/`.
- On the real database (12 November 2026): the functions were run in a test that was rolled back, and the two
  deployed functions were called once each. They answered "closed" and "bad signature", as they should.
- On Stripe's test account (12 November 2026): the table in "What the test account confirmed".
