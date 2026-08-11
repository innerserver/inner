# Inner Google Helper - Chrome Web Store Listing

## Summary
Open Google Docs, Slides, and Sheets in real Chrome tabs and share Google file links back to Inner.

## Description
Inner Google Helper gives Inner users a reliable Google Workspace workflow. Google blocks many Docs, Slides, and Sheets sign-in/editing screens inside iframes, so this extension opens Google Workspace in real browser tabs and lets users send the current Google file link back to Inner.

Features:
- Open Google Docs, Slides, and Sheets.
- Create new Docs, Slides, and Sheets.
- Save your Inner app URL.
- Share the active Google file link back to Inner.
- Adds a small Share in Inner helper on Google Docs pages.

This extension does not bypass Google security or network rules. It only opens official Google Workspace pages in normal browser tabs and helps users share links back into their Inner workspace.

## Category
Productivity

## Language
English

## Single Purpose
Open Google Workspace files in real tabs and share those links back into Inner.

## Permissions Justification
- `storage`: saves the user's Inner app URL.
- `tabs`: opens Docs, Slides, Sheets, and Inner share links in browser tabs.
- `https://docs.google.com/*`: shows the Share in Inner helper on Google Docs, Slides, and Sheets pages.

## Manual Publish Steps
1. Go to https://chrome.google.com/webstore/devconsole
2. Sign in with the Google account that owns the extension.
3. Pay/confirm the Chrome Web Store developer registration if Google asks.
4. Click `New item`.
5. Upload `inner-google-helper-chrome-store.zip`.
6. Fill the listing with the text above.
7. Upload screenshots if requested.
8. Set visibility to Unlisted or Public.
9. Submit for review.

## Testing Before Upload
1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select `extensions/inner-google-helper`.
5. Open the extension popup and save your Inner app URL.
6. Open a Google Doc and test Share in Inner.
