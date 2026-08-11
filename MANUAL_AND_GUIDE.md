# Inner Manual and Admin Guide

## Start Here

Inner is a private workspace app with accounts, rooms, DMs, uploads, voice/screen tools, admin controls, HMD tools, and Google Docs/Slides/Sheets tabs.

Use the hardcoded owner admin account for full controls. Normal users should not see Admin, HMD, or Domain tabs.

## Phone Navigation

On phone, tap the three-line menu button in the top-left to open the sidebar. Tap any tab to switch pages. The sidebar closes after selecting a tab.

If the phone still shows an old layout after deploy, hard refresh or remove/reinstall the home-screen app shortcut.

## Onboarding Tutorials

The full standalone handout is `TUTORIALS_BY_ACCOUNT_TYPE.md`.

Every account type gets a role-specific guide on the Dashboard:

- Member: profile, friends, messages, uploads, Google Docs/Slides/Sheets.
- Moderator: profile, rooms/messages, DMs, moderation expectations, docs.
- Admin: server settings, account requests, announcements, feature controls, backups.
- HMD/dev: metrics, storage, localhost tools, bots/plugins, automod, recovery work.

Users can press Dismiss to hide the guide. They can press Show guide on the Dashboard to bring it back.

## Accounts and Signup

Admin > Server controls signup mode:

- Request mode: users request an account and wait for admin review.
- Open signup: users can create a normal member account directly.

The login screen only shows the request/open-signup form after the user presses **Create or request account**.

When users create or request an account, tell them to choose **Always allow** if the browser asks for location. Inner uses this for server allocation and admin request review.

Members are normal students/users. Moderator is intended for teacher/mod tools. Admin/HMD/dev should only be assigned by the owner admin.

Admins can approve/decline requests in Admin > Account requests.

## Admin Account Search

Open Admin > Accounts.

Use:

- Search box: username, display name, email, phone, role, IP, device, or created-by text.
- Grade dropdown: choose Grade 6-12, College, Staff, Other, or No grade.
- Show all: displays all accounts.

Admin/HMD/dev accounts show by default. Member accounts show when searched, grade-filtered, or Show all is enabled.

To change a grade, search the account, choose the grade in that account row, then press Save grade.

## Friends and Grade Search

Friends are grade-aware.

Normal users see same-grade people by default. To find someone outside the grade, search their exact username, email, or phone.

Use Friends > Grade dropdown > Search grade to list allowed candidates for that grade.

## Docs

Inner now uses Google Workspace inside the app:

- Google Docs: embedded Google Docs launcher/editor.
- Slides: embedded Google Slides launcher/editor.
- Sheets: embedded Google Sheets launcher/editor.

Google may block sign-in or editing inside the iframe. If that happens, use Open full tab once, then return to Inner. Files save in the user's Google account.

Admin > Hidden tabs / Feature locks / Paywalls includes Docs. That controls Google Docs, Slides, and Sheets together.

## Uploads

Files page supports multi-file uploads and private uploads.

Private upload means only the uploader and admins should see it.

For Render persistence, use a persistent disk:

```env
INNER_DATA_DIR=/var/data/inner
```

Mount the Render disk at:

```txt
/var/data
```

For very large videos, use Cloudinary/S3/Bunny later. Render disk helps persistence, but Render memory and request limits can still affect giant uploads.

## Email

Use Resend or SMTP env vars. For Resend:

```env
RESEND_API_KEY=your_resend_key
INNER_EMAIL_FROM=Inner <onboarding@resend.dev>
```

After verifying your domain in Resend, change `INNER_EMAIL_FROM` to your verified sender.

Report recipients are set in Admin > Server > Report emails.

## Voice, Video, and Screen Share

Voice/video/screen share need HTTPS and ICE servers.

Use separate env vars:

```env
INNER_STUN_URL=stun:stun.l.google.com:19302
INNER_TURN_URL=turn:YOUR_TURN_HOST:3478
INNER_TURN_USERNAME=YOUR_TURN_USERNAME
INNER_TURN_CREDENTIAL=YOUR_TURN_PASSWORD
INNER_RTC_RELAY_ONLY=false
```

If calls work locally but not between networks, TURN is the usual missing piece.

## Admin Quick Edit

Admin > Quick edit studio lets the owner change:

- App name
- Connected/disconnected labels
- Server on/off label
- Version badge
- Dashboard update title/note
- Notice banner
- Accent color
- Density
- Custom CSS

## Hidden Tabs and Locks

Admin > Hidden tabs hides tabs from normal users.

The owner admin can still see hidden tabs. Add allowed usernames to let specific users access a hidden feature.

Admin > Active locks temporarily disables a feature.

Admin > Paywall rules can require a paid Store item before access.

## Google Docs, Slides, and Sheets

Tabs:

- Google Docs: `/google-docs`
- Slides: `/slides`
- Sheets: `/sheets`

Buttons:

- Open full tab: opens Google in a browser tab.
- New doc/slides/sheet in app: starts a new Google file inside the Inner panel when Google permits it.
- Share link: sends the Google app link through Inner share tools.

## Browser Rules and Sharing

Admin > Browser rules controls what normal users can open in the Inner Browser.

- Blocked sites are rejected by Inner.
- Allow-only mode lets users open only approved domains.
- The public Browser full-tab fallback still opens through Inner's browser route, so rules still apply.

From Browser, users can pick a friend/group and press **Send in Inner** to share the current link as a link, doc, slides, sheet, or app item.

## Backups

Admin > Backups can create and restore backups.

Backups include account data, messages, DMs, settings, and file records. Uploaded file contents remain in the upload storage folder unless separately backed up.

## GitHub Upload Commands

Run this inside your app folder, usually `C:\inner`:

```powershell
cd C:\inner
git config --global user.email "dev.s.shah2013@gmail.com"
git config --global user.name "Dev Shah"
git status
git add .
git commit -m "final inner update"
git branch -M main
git remote remove origin
git remote add origin https://github.com/devshah20-coder/inner.git
git push -u origin main --force
```

If GitHub says repository not found, create the `inner` repo on GitHub under `devshah20-coder`, then rerun from `git remote remove origin`.

## Render Deploy Notes

After pushing to GitHub, redeploy the Render service.

Important env vars:

```env
NODE_VERSION=20
INNER_ADMIN_PASSWORD=your_admin_password
INNER_DATA_DIR=/var/data/inner
RESEND_API_KEY=your_resend_key
INNER_EMAIL_FROM=Inner <onboarding@resend.dev>
INNER_STUN_URL=stun:stun.l.google.com:19302
INNER_TURN_URL=turn:YOUR_TURN_HOST:3478
INNER_TURN_USERNAME=YOUR_TURN_USERNAME
INNER_TURN_CREDENTIAL=YOUR_TURN_PASSWORD
```

After deploy, hard refresh the phone/browser if the old UI is still showing.
