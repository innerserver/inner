# Google Workspace and Browser Fix

Google Docs, Slides, and Sheets often block iframe sign-in/editing. Inner now treats Google Workspace as a launcher and opens reliable full tabs.

## What changed

- `Google Workspace > New in app` now opens a real Google tab for creating files.
- `Google Workspace > Open full tab` opens the selected Google app in a real tab.
- Inner Browser `Full tab` opens the real website, not the proxy preview.
- The embedded Browser remains as a simple preview for pages that allow it.
- Added a Chrome/Edge helper extension in:
  `extensions/inner-google-helper`

## Install the helper extension

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select:
   `extensions/inner-google-helper`
5. Pin `Inner Google Helper`.
6. Click it, paste your deployed Inner URL, and press `Save URL`.

## Use it

- Use the extension buttons to open Docs, Slides, Sheets, or create new files.
- On Google Docs/Slides/Sheets pages, use `Share in Inner` to send that link back into Inner.

## Important

This does not bypass Google security or school/network blocks. It gives the working path: real browser tabs plus Inner link sharing.
