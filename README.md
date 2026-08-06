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
