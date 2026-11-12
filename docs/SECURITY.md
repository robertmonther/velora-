# Security check, 12 November 2026

Robert's rule: every product gets a Strix security test before launch.

**What was done:** a review by hand of the whole site, the database rules, the two payment functions and the phone
app, along the OWASP Top 10 (2025). What it found is fixed and listed below.
**What was not done:** the Strix run itself. Strix needs either Docker plus a paid AI key, or an account on its
cloud service. Neither exists here, and both cost money or need a sign-up, so that step waits for Robert's OK. It
is the last line of this page.

## Found and fixed

| # | What | Risk | Fix |
| --- | --- | --- | --- |
| 1 | The server sold any song ID that looked right, under the title the browser sent. Someone could pay for a made-up song and get a real-looking certificate with any title on it. | Medium | The server now knows every song it may sell (the uploaded ones and a list of the bundled ones). An unknown song is refused, and certificates always carry the catalogue's own title. |
| 2 | An account with Premium running could be deleted, and the monthly payment would have gone on without an account. | Medium | Deleting is refused while Premium is running, with a plain message (cancel first, or write to us). |
| 3 | The "delete my account" window threw a script error when the server said no, and the button stayed dead. | Low | Fixed. Found by the new check for point 2. |
| 4 | Another site could have shown Velora inside a frame and tricked clicks onto Pay or Publish. | Medium | The host now sends "nobody may frame this site" (`hosting/.htaccess`, `vercel.json`). This cannot be set from the page itself, so the githack test link does not have it. |
| 5 | The payment window moved under the finger when an error line appeared, so a tap could miss the tick box. | Low | The window no longer redraws while it is being used. |
| 6 | The two payment functions failed silently. | Low | They now write a line to the server log (never a key, never a buyer's details). |
| 7 | The demo banner could have stayed up while real payments were on. | Low | The banner and every "(demo)" label disappear as soon as the server says the shop is open. |
| 8 | The Android app allowed phone backups of its storage, which holds the sign-in. | Low | Backups are switched off for the app. |

## Checked and in order

- **Who may do what (database).** Every table has row rules. Browsers cannot write to any table directly; everything
  goes through functions that check the caller. Money and rights are written only with the server's own key.
  Checked on the real database in tests that were rolled back: a visitor and a signed-in user were each refused for
  every write they should not make. Supabase's own advisor shows no errors; its warnings list the functions that
  are meant to be public.
- **Payments.** Prices never come from the browser. The buyer can only be sent back to the site's own addresses. A
  payment message needs a valid signature and must be fresh; the same message twice gives one license.
- **Text from people** (names, titles, lyrics, license fields) is escaped before it is shown. The page's content rules
  allow scripts only from the site itself, so a stolen sign-in through injected script is unlikely.
- **Secrets.** None in the repo (scanned). The publishable key in `config.js` is meant to be public. The owner setup
  code is stored only as a fingerprint, and ten wrong tries lock it.
- **Files.** Uploads are limited by type, size and folder, and a published song's files cannot be replaced.
- **Libraries.** The site ships its own copies (no scripts from other servers). The phone app's packages: 0 known
  vulnerabilities (`npm audit`, 12 November 2026).
- **The phone app.** No shop inside. Web debugging is off in release builds. Only https.

## Open, with an owner

| What | Who | When |
| --- | --- | --- |
| Password rules on the server: the site asks for 10 characters, but the server's own minimum is still its default. Set it to 10 in Supabase (Authentication, Sign In / Providers, Email). | Robert, in the dashboard (step 2) | Before accounts open to the public |
| "Leaked password protection" is off. It is a paid-plan feature of Supabase. | Money Map decision | With the paid plan |
| No limit on how often one visitor may call the server (sign-up emails are limited by Supabase; the rest is not). | To watch | After launch; a limit at the host or in front of it if misuse shows |
| Sign-up says "this email already has an account". It helps honest users and tells a curious person that an address is registered. | Robert decides | Before launch |
| The build workflows use GitHub's own actions by version name, not by exact fingerprint. | Later | When the repo goes private |
| The test branch `ci-perm-test` on GitHub is left over from a permission test and can be deleted. | Robert (one tap on GitHub) | Any time |
| **The Strix run.** | Robert's OK for the cost | Before the real launch |

## The Strix run, when Robert says go

On his laptop, with Docker running and an AI key (cost: the AI usage of the run; cap it with `--max-budget`):

```bash
pipx install strix-agent
export STRIX_LLM="<model id>"; export LLM_API_KEY="<key>"
# the code, and the site on its test address, together
strix -n -t ./ -t https://<the test address> --scan-mode standard --max-budget 10 \
  --instruction "Static site with Supabase. Focus on broken access control in the database functions, the checkout and payment-webhook functions, stored XSS in song fields, and account flows. Do not create real accounts with real email addresses."
```

Only the site's own address and this repo may be scanned. Results land in `strix_runs/`; fix, run again, and note
the result here.
