// Copies the site into app/www for the phone app. Run from the app folder:  node build-www.mjs
// The app carries the pages, styles, scripts, fonts and catalogue. Songs, covers and videos are NOT copied:
// the app loads them from the same place as the website (config.js: mediaFrom, siteUrl), so the app stays small
// and a new song needs no new app version.
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, ".."), out = join(here, "www");
const FILES = ["index.html", "styles.css", "studio.css", "config.js", "app.js", "backend.js", "studio.js", "studio-audio.js", "encoder-worker.js", "legal.js", "manifest.json"];
const FOLDERS = ["data", "vendor", "assets"];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of FILES) { if (!existsSync(join(root, f))) throw new Error("missing " + f); cpSync(join(root, f), join(out, f)); }
for (const d of FOLDERS) cpSync(join(root, d), join(out, d), { recursive: true });

// When the site has its own address and serves the media itself, the app's page must be allowed to load from it.
const cfg = readFileSync(join(root, "config.js"), "utf8");
const site = (cfg.match(/siteUrl:\s*"(https:\/\/[^"\s]+)"/) || [])[1];
if (site) {
  const origin = new URL(site).origin, p = join(out, "index.html");
  let html = readFileSync(p, "utf8");
  for (const part of ["img-src", "media-src", "connect-src"]) html = html.replace(new RegExp("(" + part + " [^;]*)"), "$1 " + origin);
  writeFileSync(p, html);
  console.log("media and links may use", origin);
}
console.log("app/www is ready");
