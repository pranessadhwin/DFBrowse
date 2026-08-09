# DFBrowse

A focused study browser built with Electron. DFBrowse only allows websites on
your study allowlist, and the allowlist is protected by a feature password.

## Install on Windows

1. Download **DFBrowseSetup-1.0.0.exe** from the
   [Releases](https://github.com/pranessadhwin/DFBrowse/releases) page.
2. Run the installer (it installs like any other browser — you can choose the
   install folder and whether to create shortcuts).
3. Open DFBrowse and click **Set default** in the banner at the top, or set it
   in **Windows Settings → Apps → Default apps → Web browser**. Once set, links
   you click anywhere in Windows open directly in DFBrowse.

## Development

```bash
npm install     # install dependencies
npm start       # run from source
npm run build   # build the Windows installer (NSIS)
npm run test:policy
```

The Windows installer is also built automatically by GitHub Actions
(`.github/workflows/build-windows.yml`) and published as a release; you can
trigger a rebuild from the **Actions** tab at any time.

## Google sign-in

Google sign-in happens **inside DFBrowse** — no system browser round-trip.
Study sites load in a native Electron `BrowserView` that presents itself as
Chrome on Windows:

- `app.userAgentFallback` plus a CDP `Emulation.setUserAgentOverride` provide a
  real Chrome User-Agent (including Client Hints metadata) to every page.
- An injected script removes the `navigator.webdriver` automation flag and
  restores `window.chrome`, `plugins`, `vendor`, and `languages`.
- Google account, OAuth, and anti-abuse/challenge hosts
  (`accounts.google.com`, `google.com/sorry`, `recaptcha.net`, `gstatic.com`,
  …) are allowed for redirects and popups, so the whole sign-in flow — CAPTCHA
  and "verify it's you" included — stays in the app.
- Everything else still obeys the study allowlist: deliberate navigations
  (address bar, quick links) are strictly limited to allowed sites, and
  top-level loads to anything else are cancelled in the main process.

The BrowserView is controlled from the main process: the renderer sends
navigation commands (navigate, back, forward, reload) and receives URL,
loading, and blocked-page updates over IPC.
