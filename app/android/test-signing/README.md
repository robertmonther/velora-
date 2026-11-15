# The test signing key (public on purpose)

`velora-test.keystore` signs the Android **test** builds (`app.velora.test`) and nothing else.

- Why it is here: Android only installs a new version over an old one when both are signed with the same key.
  Before 15 November 2026 every build made its own throwaway key, so each new test build needed the old app
  removed first (and that wipes the sign-in and the settings). With one fixed key, a new test build installs
  over the one before it.
- It is not a secret: password `android`, alias `velora-test`. Anyone can read it here. That is the same
  arrangement as the "debug key" every Android project has; it only matters for test builds that a person
  installs by hand.
- It must never sign a build for Google Play. The store build gets its own key, made on Robert's side, which
  never enters this repo (and the store app gets its own app id, not `app.velora.test`).
- `SHA256` holds the key's certificate fingerprint. The build on GitHub compares the finished test file with
  it and stops if they differ, and the emulator job tries the real thing: the build before, then the new one
  on top of it.
