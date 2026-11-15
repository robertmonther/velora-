#!/usr/bin/env python3
"""Opens the Velora test app on the Android emulator that the CI job started, and takes pictures of it.

    python3 app/ci/look.py <folder for the pictures> <the .apk> [prefix for the file names] [the build before]

Why: nobody at the keyboard has an Android phone. This is a real Android (not a browser pretending), so it shows
what a phone shows: the status bar, the launch, the phone's own "allow the microphone?" question.
It needs adb and a running emulator; .github/workflows/app.yml provides both. The pictures are attached to the
pre-release "android-test", next to the test file."""
import os, re, subprocess, sys, time

OUT = sys.argv[1] if len(sys.argv) > 1 else "look"
APK = sys.argv[2] if len(sys.argv) > 2 else "velora-android-test.apk"
TAG = sys.argv[3] if len(sys.argv) > 3 else ""
BEFORE = sys.argv[4] if len(sys.argv) > 4 else ""        # the test build before this one, when there is one
APP = "app.velora.test"
os.makedirs(OUT, exist_ok=True)

def adb(*a, timeout=180):
    return subprocess.run(["adb", *a], capture_output=True, timeout=timeout).stdout
def sh(cmd):
    return adb("shell", cmd).decode("utf-8", "replace").strip()
def shot(name):
    data = adb("exec-out", "screencap", "-p")
    open(os.path.join(OUT, f"{TAG}{name}.png"), "wb").write(data)
    print("picture:", name, len(data), "bytes", flush=True)
def screen():
    """The screen as the phone describes it: every text and label with its place."""
    for _ in range(3):
        sh("uiautomator dump /sdcard/ui.xml >/dev/null 2>&1")
        xml = adb("exec-out", "cat", "/sdcard/ui.xml").decode("utf-8", "replace")
        if "<node" in xml: return xml
        time.sleep(1.5)
    return ""
def find(xml, pattern):
    """The middle of the first thing on screen whose text or label fits."""
    for m in re.finditer(r"<node [^>]*>", xml):
        n = m.group(0)
        t = re.search(r'text="([^"]*)"', n); d = re.search(r'content-desc="([^"]*)"', n)
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if b and ((t and re.search(pattern, t.group(1), re.I)) or (d and re.search(pattern, d.group(1), re.I))):
            x1, y1, x2, y2 = map(int, b.groups())
            return (x1 + x2) // 2, (y1 + y2) // 2
    return None
def tap(p):
    sh(f"input tap {p[0]} {p[1]}")
def texts(xml):
    return [t for t in re.findall(r'(?:text|content-desc)="([^"]+)"', xml)][:60]
def settle():
    """The emulator's own windows can sit on top of the app (its launcher or a system app "isn't responding"):
    tap Wait until they are gone, and hand back the screen as it is then."""
    xml = screen()
    for _ in range(4):
        wait = find(xml, r"^Wait$") if re.search(r"isn.{1,6}t responding", xml) else None
        if not wait: break
        note("(the emulator showed its own \"isn't responding\" window on top; tapped Wait)")
        tap(wait); time.sleep(2.5); xml = screen()
    return xml
def start():
    sh(f"am force-stop {APP}")
    print(sh(f"am start -W -n {APP}/.MainActivity"), flush=True)

notes = []
def note(line):
    print(line, flush=True); notes.append(line)

note("Android " + sh("getprop ro.build.version.release") + " (API " + sh("getprop ro.build.version.sdk") + "), " + sh("wm size") + ", " + sh("wm density"))
note("WebView: " + " | ".join(l.strip() for l in sh("dumpsys webviewupdate").splitlines() if "Current WebView package" in l or "versionName" in l)[:300])
def install(path, *flags):
    r = subprocess.run(["adb", "install", *flags, path], capture_output=True, timeout=240)
    return (r.stdout + r.stderr).decode("utf-8", "replace").strip().replace("\n", " ")
def version():
    m = re.search(r"versionName=(\S+)", sh(f"dumpsys package {APP}"))
    return m.group(1) if m else "?"

# Does the new build install over the one before it, the way it will on a phone that already has the app?
if BEFORE and os.path.isfile(BEFORE):
    sh(f"pm uninstall {APP}")
    first = install(BEFORE); was = version()
    over = install(APK, "-r")
    if "Success" in over:
        note(f"Update: the build before ({was}) was on the phone; the new build installed over it without removing it (now {version()})")
    else:
        why = re.search(r"INSTALL_[A-Z_]+", over)
        note(f"Update: the new build did NOT install over the build before ({was}): {why.group(0) if why else over[:160]}. On a phone the old app has to be removed first")
        sh(f"pm uninstall {APP}"); print(install(APK, "-r"), flush=True)
    if "Success" not in first: note("(the build before did not install at all: " + first[:160] + ")")
else:
    note("Update: there is no build before this one to try an update with")
    print(install(APK, "-r"), flush=True)
note("The phone says the app is version " + version())
time.sleep(6)                                            # installing keeps a small emulator busy for a moment
sh("logcat -c")

# 0. The first moment after the tap on the icon (the launch screen), on a phone in light mode
sh("cmd uimode night no"); sh(f"am force-stop {APP}"); sh(f"am start -n {APP}/.MainActivity"); time.sleep(0.3); shot("0-launch")
time.sleep(1.2); shot("0b-launch-a-second-later")

# 1. The home screen, on a phone in light mode (the way most phones are set)
time.sleep(15); settle(); time.sleep(1); shot("1-home-light")
xml = screen(); open(os.path.join(OUT, f"{TAG}screen-home.xml"), "w").write(xml)
note("On the home screen the phone sees: " + " / ".join(texts(xml))[:900])
note("A native title bar above the page (the bug Robert found on 15 Nov) is " + ("THERE" if re.search(r'resource-id="android:id/action_bar(_container)?"', xml) else "not there"))
web = re.search(r'resource-id="app\.velora\.test:id/webview"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml) or re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*resource-id="app\.velora\.test:id/webview"', xml)
note("The page fills: " + (str(tuple(map(int, web.groups()))) if web else "?") + " of " + sh("wm size"))
if not find(xml, r"^(Search|Search songs)$"):          # the page describes itself to the phone only once asked: ask again
    time.sleep(2.5); xml = screen()

# 2. The microphone in the search field (since 15 Nov there is no floating one on Home, Robert's choice):
#    open Search, tap the microphone, then the phone's own question and the listening sheet
go = find(xml, r"^(Search|Search songs)$")
if go: tap(go); time.sleep(3)
else: note("the way to Search was not found by its label")
xml = screen(); mic = find(xml, r"^Search by voice$")
if not mic:
    time.sleep(2.5); xml = screen(); mic = find(xml, r"^Search by voice$")
if mic: note("the search field's microphone found at " + str(mic)); tap(mic)
else: note("the search field's microphone was NOT found by its label")
time.sleep(3); shot("2-mic-tapped")
xml = screen(); note("After tapping the mic: " + " / ".join(texts(xml))[:700])
allow = find(xml, r"^(While using the app|Only this time|Allow)$")
if allow:
    note("the phone asked for the microphone; answering 'allow'"); tap(allow); time.sleep(4); shot("3-after-allow")
    xml = screen(); note("After allowing: " + " / ".join(texts(xml))[:700])
time.sleep(9); shot("4-a-moment-later")
xml = screen(); note("A moment later: " + " / ".join(texts(xml))[:700])
sh("input keyevent 4"); time.sleep(1)

# 3. The same home screen on a phone in dark mode
sh("cmd uimode night yes"); start(); time.sleep(13); settle(); shot("5-home-dark"); sh("cmd uimode night no")

log = adb("logcat", "-d", "-v", "brief").decode("utf-8", "replace")
keep = [l for l in log.splitlines() if re.search(r"Capacitor|SpeechRecognition|AndroidRuntime|chromium.*(Uncaught|Error)|app\.velora", l)]
open(os.path.join(OUT, f"{TAG}log.txt"), "w").write("\n".join(keep[-400:]))
open(os.path.join(OUT, f"{TAG}notes.txt"), "w").write("\n".join(notes) + "\n")
