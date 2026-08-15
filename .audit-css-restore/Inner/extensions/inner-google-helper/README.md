# Inner Google Helper

This helper fixes the practical Google Workspace problem by opening Docs, Slides, and Sheets in real browser tabs instead of trying to force Google inside an iframe.

Google blocks many embedded sign-in/editing flows. This extension does not bypass Google security. It gives Inner users a reliable tab-based workflow and lets them share the current Google link back into Inner.

## Install in Chrome or Edge

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder:
   `extensions/inner-google-helper`
5. Pin the `Inner Google Helper` extension.
6. Click the extension, paste your Inner app URL, and press `Save URL`.

Example Inner URL:

```text
https://inner-your-app.onrender.com
```

## Use

- Press `Docs`, `Slides`, or `Sheets` to open Google Workspace in a real tab.
- Press `New Doc`, `New Slides`, or `New Sheet` to create new files.
- On a Google document page, press `Share in Inner` to open Inner's DM share flow with that link.

## Why this exists

Google Docs/Slides/Sheets often refuse to run inside an iframe because of Google account and browser security. A Chrome/Edge extension cannot reliably or safely remove that restriction. The reliable fix is to use real tabs and share the links inside Inner.
