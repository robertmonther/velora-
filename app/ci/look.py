#!/usr/bin/env python3
"""Opens the Velora test app on the Android emulator that the CI job started, and takes pictures of it.

    python3 app/ci/look.py <folder for the pictures> <the .apk> [prefix for the file names]

Why: nobody at the keyboard has an Android phone. This is a real Android (not a browser pretending), so it shows
what a phone shows: the status bar, the launch, the phone's own "allow the microphone?" question.
It needs adb and a running emulator; .github/workflows/app.yml provides both. The pictures are attached to the
pre-release "android-test", next to the test file."""
import os, re, subprocess, sys, time

OUT = sys.argv[1] if len(sys.argv) > 1 else "look"
APK = sys.argv[2] if len(sys.argv) > 2 else "velora-android-test.apk"
TAG = sys.argv[3] if len(sys.argv) > 3 else ""
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
def start():
    sh(f"am force-stop {APP}")
    print(sh(f"am start -W -n {APP}/.MainActivity"), flush=True)

notes = []
def note(line):
    print(line, flush=True); notes.append(line)

note("Android " + sh("getprop ro.build.version.release") + " (API " + sh("getprop ro.build.version.sdk") + "), " + sh("wm size") + ", " + sh("wm density"))
note("WebView: " + " | ".join(l.strip() for l in sh("dumpsys webviewupdate").splitlines() if "Current WebView package" in l or "versionName" in l)[:300])
print(adb("install", "-r", APK).decode("utf-8", "replace"), flush=True)
sh("logcat -c")

# 1. The home screen, on a phone in light mode (the way most phones are set)
sh("cmd uimode night no"); start(); time.sleep(18); shot("1-home-light")
xml = screen(); open(os.path.join(OUT, f"{TAG}screen-home.xml"), "w").write(xml)
note("On the home screen the phone sees: " + " / ".join(texts(xml))[:900])
note("A native title bar (the bug of 15 Nov) is " + ("THERE" if re.search(r'resource-id="android:id/action_bar', xml) or re.search(r'class="android.widget.TextView"[^>]*text="Velora"', xml) or re.search(r'text="Velora"[^>]*class="android.widget.TextView"', xml) else "not there"))

# 2. The microphone: the phone's own question, then the listening sheet
mic = find(xml, r"^Voice: say a song")
if not mic:
    w, h = map(int, re.search(r"(\d+)x(\d+)", sh("wm size")).groups()); d = int(re.search(r"(\d+)", sh("wm density")).group(1)) / 160
    mic = (int(w - 45 * d), int(h - (48 + 64 + 16 + 29) * d)); note("mic button not found by its label; tapping where it should be: " + str(mic))
else: note("mic button found at " + str(mic))
tap(mic); time.sleep(3); shot("2-mic-tapped")
xml = screen(); note("After tapping the mic: " + " / ".join(texts(xml))[:700])
allow = find(xml, r"^(While using the app|Only this time|Allow)$")
if allow:
    note("the phone asked for the microphone; answering 'allow'"); tap(allow); time.sleep(4); shot("3-after-allow")
    xml = screen(); note("After allowing: " + " / ".join(texts(xml))[:700])
time.sleep(9); shot("4-a-moment-later")
xml = screen(); note("A moment later: " + " / ".join(texts(xml))[:700])
sh("input keyevent 4"); time.sleep(1)

# 3. The same home screen on a phone in dark mode
sh("cmd uimode night yes"); start(); time.sleep(14); shot("5-home-dark"); sh("cmd uimode night no")

log = adb("logcat", "-d", "-v", "brief").decode("utf-8", "replace")
keep = [l for l in log.splitlines() if re.search(r"Capacitor|SpeechRecognition|AndroidRuntime|chromium.*(Uncaught|Error)|app\.velora", l)]
open(os.path.join(OUT, f"{TAG}log.txt"), "w").write("\n".join(keep[-400:]))
open(os.path.join(OUT, f"{TAG}notes.txt"), "w").write("\n".join(notes) + "\n")
