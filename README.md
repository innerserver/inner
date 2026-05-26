# Inner

A no-dependency private workspace app with:

- Login with username and password
- Live messages in the main room and admin-created side rooms
- Direct messages between accounts, with admin review and admin-only deletion
- Photo and video attachments in room messages and DMs
- Optimistic sending, failed-send retry, edit support, replies, read receipts, and scroll preservation foundations
- In-app popups and optional browser alerts for incoming messages and DMs
- Store/payment request tracking for paid items
- Admin AI helper for small change requests when `OPENAI_API_KEY` is configured
- Uploads for video, audio, documents, MUN files, and important documents
- Browser screen sharing with WebRTC signaling
- Server on/off controls
- Timed feature locks for messages, DMs, files, screen, side rooms, and VPN
- Admin backup snapshots
- VPN profile settings with username, password status, location, and enable/disable state
- Admin account manager for creating, deleting, temp-banning, role changes, persistent-login access, and password resets
- Free Quick Edit Studio for admins to change app name, notices, accent color, density, rounded style, and small custom CSS without an API key
- PDF feature coverage notes are in `docs/PDF-Feature-Coverage.md`, including the newest admin log search/export, friend-only DM/group chat rules, invite-only room invites, HMD localhost tools, and service scaling controls.

## Run

```powershell
node server.js
```

Open:

```text
http://127.0.0.1:3000
```

Other laptops on the same Wi-Fi should use the LAN link shown in the desktop launcher, usually something like:

```text
http://192.168.1.23:3000
```

Keep Inner running on one main laptop. Everyone else should open that main laptop's LAN link. If each laptop runs its own `Inner.exe`, each laptop gets separate local data. If Windows asks about firewall access for `node.exe` or Inner, allow access on Private networks.

Inner is also installable in browsers that support web apps. Open the URL, then use the browser's install action or the in-app Install button when it appears.

Click **Enable alerts** in the top bar if you want popups for incoming messages and DMs. System/browser alerts work best on localhost or HTTPS; the in-app popup still appears while Inner is open.

The Store tab lets admins list paid items and lets users request them. Add a payment link from your payment provider if you want users to open a real checkout/payment page. Inner tracks requests and payment status, but it does not directly process credit cards by itself.

The Admin AI helper uses the OpenAI Responses API when `OPENAI_API_KEY` is set before starting Inner or when an admin saves a key in the Admin panel. Saved keys stay on the server in the `data` folder and are never shown back to browsers.

Admins can also use **Quick edit studio** in the Admin panel for free small changes inside the app. It does not call AI or any paid API. Use it for app name text, a site notice, accent color, compact/comfortable density, rounded controls, and small CSS tweaks.

## Desktop app

Build the Windows desktop launcher:

```powershell
.\desktop\build.ps1
```

Run:

```text
dist\Inner\Inner.exe
```

The desktop app starts the same Inner server, opens the browser app, and gives you Start, Stop, Open, and Data controls. The browser version and desktop version use the same `data/` storage when run from the same folder.

## Cloud

Inner can be deployed to a Node web host. A host gives the real public HTTPS link after deployment, for example:

```text
https://inner.onrender.com
```

For Render, push this repo to GitHub, create a new Render Blueprint or Web Service from the repo, and use the included `render.yaml`. Render should run:

```text
npm start
```

Render gives the public app an HTTPS URL automatically. Open the `https://...onrender.com` link, not the internal `http://` server log link. The included `render.yaml` also enables `INNER_FORCE_HTTPS=true`, so public HTTP requests are redirected to HTTPS.

Render Free does not preserve local filesystem uploads or JSON data across restarts. This app uses MongoDB for JSON data when `MONGODB_URI` is set, so accounts, messages, settings, upload metadata, logs, read receipts, and profiles survive redeploys. Uploaded file bytes can use Cloudinary first, with MongoDB GridFS still supported as a fallback.

Recommended cloud upload setup:

```text
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=inner_uploads
INNER_UPLOAD_PROVIDER=cloudinary
INNER_REQUIRE_CLOUD_STORAGE=true
```

Recommended MongoDB data setup:

```text
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster-name.mongodb.net/inner?retryWrites=true&w=majority
MONGODB_DB=inner
INNER_REQUIRE_CLOUD_STORAGE=true
INNER_DATA_DIR=/tmp/inner-data
INNER_UPLOAD_INLINE_LIMIT=0
```

With `INNER_REQUIRE_CLOUD_STORAGE=true`, uploads are intentionally refused unless Cloudinary or MongoDB/GridFS is connected. That prevents fake-success uploads that vanish later after redeploys. When Cloudinary is configured, browsers upload straight to Cloudinary and then Inner saves the file record. Long videos do not pass through Render, so Render request timeouts, disk limits, and memory restarts are avoided. If a very large video still fails, check the Cloudinary response and your Cloudinary plan/upload size limits. Localhost mode disables that requirement for the desktop/local version.

Dashboard announcements:

- Users land on the Dashboard after login.
- Admins can post announcements from Admin > Announcements.
- Announcements can target the whole platform or one specific room.
- Room announcements only show to users who can access that room.

Account requests require browser location for server allocation and can require contact details. Admins can switch between request-only and open-signup mode in the Admin panel. Email alerts go to the report emails saved in Admin > Server first, then fall back to `INNER_REPORT_EMAILS`.

Resend email setup: create a Resend account, create an API key, then add these in Render > Environment:

```text
INNER_REPORT_EMAILS=admin1@example.com,admin2@example.com,admin3@example.com,admin4@example.com
RESEND_API_KEY=re_your_real_resend_key_here
INNER_EMAIL_FROM=Inner <onboarding@resend.dev>
INNER_EMAIL_REPLY_TO=innerservers@gmail.com
INNER_SIGNUP_MODE=open
INNER_REQUIRE_CONTACT=false
```

After you verify a domain in Resend, switch `INNER_EMAIL_FROM` to something like `Inner <noreply@yourdomain.com>`.

Optional fallback providers:

```text
INNER_SMTP_HOST=smtp.gmail.com
INNER_SMTP_PORT=465
INNER_SMTP_SECURE=true
INNER_SMTP_USER=your-gmail@gmail.com
INNER_SMTP_PASS=your-google-app-password
INNER_EMAIL_WEBHOOK_URL=https://your-email-webhook.example.com/send
```

Use one provider key at a time if you want it simple. The Admin server panel has a "Send test email" button.

Voice, video, and screen sharing use WebRTC. Browsers require HTTPS or localhost for camera, microphone, and screen capture. For reliable calls outside the same Wi-Fi, add TURN credentials in Render's Environment tab:

```text
INNER_TURN_URLS=turn:YOUR_TURN_HOST:3478?transport=udp,turn:YOUR_TURN_HOST:3478?transport=tcp,turns:YOUR_TURN_HOST:443?transport=tcp
INNER_TURN_USERNAME=your-turn-username
INNER_TURN_CREDENTIAL=the-credential-from-the-provider
```

If your provider labels the secret as "credential", use that value for `INNER_TURN_CREDENTIAL`. It is the WebRTC password. The server also accepts `TURN_URLS`, `TURN_USERNAME`, `TURN_PASSWORD`, `INNER_TURN_PASSWORD`, `INNER_TURN_CREDENTIALS`, `INNER_TURN_HOST`, and full ICE JSON through `INNER_ICE_SERVERS_JSON`.

Turn.io is a WhatsApp/messaging platform, not automatically a generic TURN relay for this app. If Turn.io gives you normal WebRTC ICE server values, paste the `turn:`/`turns:` URLs, username, and credential into the variables above. If it does not give those, use a TURN relay provider such as Cloudflare TURN, Metered TURN, ExpressTURN, Xirsys, or Twilio Network Traversal.

If calls still fail on strict school/mobile networks after adding real TURN values, set:

```text
INNER_RTC_RELAY_ONLY=true
```

That forces WebRTC to use TURN relay candidates only. Leave it `false` if your TURN credentials are still being tested.

For local HTTPS testing, create a certificate and start the server with both paths set:

```powershell
$env:INNER_HTTPS_KEY="C:\path\to\localhost-key.pem"
$env:INNER_HTTPS_CERT="C:\path\to\localhost-cert.pem"
node server.js
```

Cloud data persistence depends on the host. On Render Free, use `MONGODB_URI` as shown above. On a paid host with a real persistent disk, local `INNER_DATA_DIR` storage also works.

## GitHub

This repo is ready to commit after you review it:

```powershell
git add .gitignore README.md package.json package-lock.json render.yaml server.js public desktop docs
git commit -m "Build Inner server and desktop app"
git push
```

The generated `dist/` folder and private `data/` folder are ignored. For sharing the `.exe`, build with `.\desktop\build.ps1` and upload the `dist\Inner` folder as a GitHub Release asset instead of committing it directly.

Default admin login:

```text
username: admin
password: Devshah@11

username: admin2
password: Devshah@11
```

Admins create every other account before that person can log in. Each account gets its own username/password and its own audit trail, so messages, DMs, and uploads show who did what and when. New accounts are members by default, but an admin can choose admin access during creation or change access later.

Admins can reset any account password, including `admin` and `admin2`. The `admin` account cannot be deleted or banned. The `admin2` account can be changed or deleted by another admin.

Admins can restore a saved backup from the Backups panel. Inner creates a safety backup first, restores accounts/messages/settings from the selected backup, then forces users to sign in again.

Side rooms can also have an optional password. Members must unlock the room before reading or posting in it; admins can bypass room passwords.

Report emails use the addresses saved in the Admin server panel first, then fall back to `INNER_REPORT_EMAILS`/`REPORT_EMAILS`. Real delivery works with `RESEND_API_KEY`, SMTP fallback settings, or `INNER_EMAIL_WEBHOOK_URL`; without one of those, Inner logs the email payload as queued.

## Notes

Uploaded files and JSON data are stored under `data/` locally. In cloud mode, JSON records are stored in MongoDB when `MONGODB_URI` is configured, and file bytes are stored in Cloudinary when the Cloudinary variables are configured. MongoDB GridFS remains available if you set `INNER_UPLOAD_PROVIDER=mongodb`. Messages, DMs, side rooms, uploaded file records, account password changes, feature locks, backups, server settings, read receipts, logs, and VPN profile settings remain after redeploys when cloud persistence is configured.

Sessions expire automatically after inactivity unless an admin enables persistent login for that account. To store data somewhere else, start the server with `INNER_DATA_DIR` pointed at another folder.

Admin controls are kept in the Admin panel. Admins can create/delete side rooms, create paid items, manage payment orders, use the AI helper, review/delete DMs, delete messages/files, create backup snapshots, set timed feature locks, reset passwords, create/delete accounts, grant/remove admin access, allow/disable persistent login, and temp-ban accounts. Messages, DMs, orders, and uploaded files show who sent/uploaded/requested them, when they did it, and the network/browser source recorded by the server. Screen and location sharing require the other user's browser to approve the request.

When the server is turned off, normal users cannot send messages, DMs, upload files, or start sharing. The admin can still sign in, use the site, and turn the server back on.

Backups are normal admin snapshots saved under `data/backups`. They are for recovery/export, not hidden deletion or panic wiping. Uploaded file contents remain under `data/uploads`, so back up that folder too if those files matter.

The VPN panel stores a protected local profile and status. It does not create an operating-system VPN tunnel or route network traffic.
