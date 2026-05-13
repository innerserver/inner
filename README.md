# Inner

A no-dependency private workspace app with:

- Login with username and password
- Live messages in the main room and admin-created side rooms
- Direct messages between accounts, with admin review and admin-only deletion
- Photo and video attachments in room messages and DMs
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

Cloud data persistence depends on the host. If the host has ephemeral storage, exported backups and uploaded files can disappear on redeploy. Use a persistent disk/volume or an external storage service for permanent cloud storage.

## GitHub

This repo is ready to commit after you review it:

```powershell
git add .gitignore README.md package.json render.yaml server.js public desktop
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

## Notes

Uploaded files and JSON data are stored under `data/`, which is created automatically when the server starts. Messages, DMs, side rooms, uploaded files, account password changes, feature locks, backups, server settings, and VPN profile settings remain there after you shut the server down and open it later.

Sessions expire automatically after inactivity unless an admin enables persistent login for that account. To store data somewhere else, start the server with `INNER_DATA_DIR` pointed at another folder.

Admin controls are kept in the Admin panel. Admins can create/delete side rooms, create paid items, manage payment orders, use the AI helper, review/delete DMs, delete messages/files, create backup snapshots, set timed feature locks, reset passwords, create/delete accounts, grant/remove admin access, allow/disable persistent login, and temp-ban accounts. Messages, DMs, orders, and uploaded files show who sent/uploaded/requested them, when they did it, and the network/browser source recorded by the server. Screen and location sharing require the other user's browser to approve the request.

When the server is turned off, normal users cannot send messages, DMs, upload files, or start sharing. The admin can still sign in, use the site, and turn the server back on.

Backups are normal admin snapshots saved under `data/backups`. They are for recovery/export, not hidden deletion or panic wiping. Uploaded file contents remain under `data/uploads`, so back up that folder too if those files matter.

The VPN panel stores a protected local profile and status. It does not create an operating-system VPN tunnel or route network traffic.
