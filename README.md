<div align="center">

# 🧠 DFBrowse

**A distraction-free browser for focused studying.**

DFBrowse is an Electron browser that only allows websites on **your study
allowlist** — and that allowlist is protected by a **feature password**, so you
can't quietly bypass it on impulse.

Built for anyone who wants to actually get work done.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-31.7.7-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white)](https://www.microsoft.com/windows)
[![Build](https://img.shields.io/badge/Build-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/build-windows.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## Why DFBrowse?

Most browsers give you the same three options: use a website blocker extension
(which you can disable in seconds), use a different browser, or just rely on
willpower.

DFBrowse removes the escape hatch. It is a **dedicated browser** whose allowed
sites are locked behind a password — so the only way to reach a distracting
site is to consciously unlock it.

## ✨ Features

- 🔒 **Password-protected allowlist** — only sites you added are reachable, and
  adding/removing them requires the feature password.
- 🎯 **Set as default browser** — links opened anywhere in Windows open
  directly in DFBrowse.
- 🔐 **Google sign-in handled safely** — embedded sign-in is cancelled and
  redirected to your real browser, where Google can verify a supported browser.
- 💾 **Remembered sign-in emails** — switch between your Google accounts with
  one click.
- 🪟 **Native Windows installer** (NSIS) built and released automatically by
  GitHub Actions.
- 🧪 **Tested policy engine** — the allowlist logic ships with unit tests.

## 🧱 Tech Stack

| Layer        | Technology                                   |
| ------------ | -------------------------------------------- |
| Shell        | [Electron](https://www.electronjs.org/) 31.x |
| Language     | JavaScript (Node.js / Electron main+renderer)|
| Packaging    | [electron-builder](https://www.electron.build/) (NSIS) |
| CI / CD      | GitHub Actions (`build-windows.yml`)         |
| Testing      | Node built-in `node:test` runner              |

## 📸 Screenshots

<!-- TODO: Add screenshots of the main window, the allowlist UI, and the
password prompt. Drop images into `docs/screenshots/` and reference them here. -->

*Coming soon.*

## 🚀 Installation (end user)

1. Download **DFBrowseSetup-1.0.0.exe** from the
   [Releases](https://github.com/pranessadhwin/DFBrowse/releases) page.
2. Run the installer — it installs like any other browser (choose the install
   folder and whether to create shortcuts).
3. Open DFBrowse and click **Set default** in the banner at the top, or set it
   in **Windows Settings → Apps → Default apps → Web browser**. Links you click
   anywhere in Windows will then open directly in DFBrowse.

## 🛠 Development

```bash
npm install        # install dependencies
npm start          # run DFBrowse from source
npm run build      # build the Windows installer (NSIS)
npm run test:policy
```

The Windows installer is also built automatically by GitHub Actions and
published as a release — trigger a rebuild anytime from the **Actions** tab.

> **Project structure**
> ```text
> src/
> ├── main.js        # Electron main process
> ├── preload.js     # Secure preload bridge
> ├── renderer.js    # UI logic
> ├── policy.js      # Allowlist / password policy engine
> ├── index.html     # Main window markup
> └── styles.css
> test/
> └── policy.test.js # Policy engine unit tests
> ```

## 🔑 Google sign-in

Google does not allow account or OAuth password pages to run inside embedded
Electron webviews. When a site starts Google sign-in, DFBrowse cancels the
embedded navigation and opens the site in the system browser, where Google can
verify a supported browser and use the user's existing session. This is
intentional: changing the User-Agent to impersonate Chrome is not a reliable or
secure fix. If DFBrowse is your default browser, keep Chrome, Edge, or Firefox
available as the system browser for sign-in.

### Remembered sign-in emails

DFBrowse can remember the Google emails you sign in with so you don't have to
start from scratch each time:

1. Open the **Google accounts** panel and click **Add email**.
2. Click **Open Google sign-in** — your default browser opens Google.
3. Sign in there, then type that email back in DFBrowse and press **Save
   email**.

After that, whenever a site starts Google sign-in, the sign-in screen lists
your saved emails and you can continue with one click. Only the email address
is stored — DFBrowse never sees or stores account passwords, and Google sign-in
always happens in your real browser.

## 🤝 Contributing

Contributions are welcome! Please read
[CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
