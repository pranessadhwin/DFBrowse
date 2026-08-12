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

Google does not allow account or OAuth password pages to run inside embedded
Electron webviews. When a site starts Google sign-in, DFBrowse cancels the
embedded navigation and opens the site in the system browser, where Google can
verify a supported browser and use the user's existing session. This is
intentional: changing the User-Agent to impersonate Chrome is not a reliable or
secure fix. If DFBrowse is your default browser, keep Chrome, Edge, or Firefox
available as the system browser for sign-in.

### Stored sign-in emails

DFBrowse can remember the Google emails you sign in with so you don't have to
start from scratch each time:

1. Open the **Google accounts** panel and click **Add email**.
2. Click **Open Google sign-in** — your default browser opens Google.
3. Sign in there, then type that email back in DFBrowse and press **Save email**.

After that, whenever a site starts Google sign-in, the sign-in screen lists your
saved emails and you can continue with one click. Only the email address is
stored — DFBrowse never sees or stores account passwords, and Google sign-in
always happens in your real browser.
