# Going live: the move to our own hosting ("step 2")

Status on 12 November 2026: everything that costs nothing is built. The site still runs only on test links.
This page is the whole list of what is left, in order. Parts A and B are done together with Robert at the computer;
they need his Hostinger and Supabase logins.

## What is already prepared

- **A ready-to-host copy of the site** on the GitHub branch `site`: only the site's own files, the songs and covers,
  and the server settings (`hosting/.htaccess`: https only, safety headers, caching). GitHub rebuilds it after every
  change (`.github/workflows/site.yml`). Nothing goes online until the host takes the branch.
- `robots.txt` keeps search engines out while the address is a test address.
- The server (Supabase): accounts, uploads, licenses, the shop (closed).
- The same folder can be made by hand: `python3 scripts/build_site.py --media --zip` gives `dist/velora-site.zip`.

## A. Hostinger (about 15 minutes)

1. **A test address.** In hPanel, add a subdomain for testing (for example `studio.` in front of a domain that is
   already there, or Hostinger's free temporary address). The real name and its domain come in their own session.
2. **Connect the branch.** Websites → Dashboard → Advanced → Git. Connect GitHub (or enter
   `https://github.com/robertmonther/velora-.git`), branch **`site`**, and as folder the subdomain's folder.
   The folder must be empty, or the deployment fails. Then Deploy.
3. **https.** Check that the free SSL certificate is on for the subdomain (Security → SSL).
4. Open the address on the phone: the home page, one song, the radio.

Automatic updates: Hostinger can take every new build of the branch by itself (Auto Deployment). Leave it off until
Robert wants changes to go online without a tap.

## B. Supabase dashboard (about 15 minutes)

1. **The site's address.** Authentication → URL Configuration: Site URL = the new address. Redirect URLs = the address
   followed by `/**`. Without this, the links in sign-up and password emails point to the wrong place.
2. **Our own email sender.** Authentication → Emails → SMTP Settings → Enable custom SMTP. Use a mailbox on the site's
   domain (for example `hello@...`; hPanel → Emails shows the server name, port and password). Supabase's built-in
   sender only reaches the project's own team and sends 2 emails an hour, so sign-up does not work for the public
   without this step.
3. **The code in the emails.** In the templates "Confirm signup" and "Reset password", add a line with the code:
   `Your code: {{ .Token }}`. The site accepts the link or the code.
4. **Passwords.** Authentication → Sign In / Providers → Email: minimum length 10.
5. Then tell Claude the address: `siteUrl` in `config.js` is set, and the phone app's shared links start to work.

## C. Test on the real address (about 10 minutes)

1. Create an account with a second email address, confirm it from the email, sign in, sign out.
2. As the owner, on the phone: upload one song from start to Publish. This is the first real upload.
3. Open the song on another device.

## What stays for later (each needs a decision or money)

| What | Needs | Where it is written |
| --- | --- | --- |
| The name, the domain, the app ID | The name session; a domain costs about €10 to €15 a year (to check) | Notion, Open questions |
| Opening the shop | Business registration, a payment provider account, the adult-content answer, VAT | `PAYMENTS.md` |
| Legal pages out of draft | One session with an IP lawyer; business details in `config.js` | `LEGAL.md` |
| The Strix security run | Docker and an AI key, or Strix's cloud (cost) | `SECURITY.md` |
| Phone apps in the stores | Apple €99 a year, Google $25 once; signing keys; a real-phone test | `app/README.md` |
| More than about 150 to 230 songs | A paid server plan (from $25 a month) or other storage: Money Map | Notion |
| Voice-tagged previews and separate clean files | A decision on the voice tag; a second file per song | `PAYMENTS.md` |
| The server sleeping | The free plan pauses after a week without visits; it is woken by hand in the dashboard | Notion |

## The launch day (not now)

1. Replace `hosting/robots.txt` with one that lets search engines in, and add the page titles and descriptions
   (the website-seo-performance skill has the list).
2. `config.js`: `demo: false`, `siteUrl`, `business`.
3. Open the shop (`PAYMENTS.md`), one real payment, one refund.
4. Make the GitHub repo private if wanted. The site keeps working (it serves its own songs); the old githack test
   links and the Android test download stop.
5. The launch plan itself (anticipation, first moment, email list) is in the Notion page.
