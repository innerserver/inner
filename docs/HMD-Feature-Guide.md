# Inner HMD Feature Guide

This guide explains what every HMD panel does in the Inner server app. Admin, HMD, and dev accounts can open the HMD view.

## Emergency Controls

Emergency mode marks the app as being in a high-alert state for admins and HMD users. It is meant for incidents, abuse, raids, or major config changes where staff need to know the server is under active control.

Metrics enabled turns the HMD metrics cards on for operational review. The metrics summarize record counts and storage health so staff can quickly tell what is happening in the app.

Theme engine stores the preferred global HMD theme setting. User profile themes still let each person change their own experience.

Save HMD writes the emergency, metrics, and theme settings to the server data folder and broadcasts the update to admin/HMD/dev users.

## Live Database Viewer

The Live database viewer shows key JSON database counts. It helps admins confirm that messages, DMs, users, reports, logs, files, store orders, rooms, and group chats are being saved.

## Storage Manager

The Storage manager shows upload storage health. It lists upload count, total upload bytes, inline backup size, inline backup limit, active data directory, and whether MongoDB/GridFS cloud storage is connected. Use it to confirm uploads and account data are using persistent storage after redeploys.

## Localhost Tools

Localhost tools show the current local runtime URLs for testing Inner without a cloud host. Loopback is for the same computer, LAN links are for phones or other devices on the same Wi-Fi, and the data/upload directory lines show where accounts, logs, and local files are being saved.

## Bot Accounts

Bot accounts lets HMD/dev staff define internal automation bot records. These records can be used later for moderation bots, helper bots, slash-command bots, or other automated app actions.

## Plugin Hooks

Plugin hooks stores plugin records for planned app extensions. Each plugin has a name, hook type, enabled state, and notes so future internal APIs or automation hooks can be tracked.

## Auto Moderation

Auto moderation lets staff turn basic moderation rules on or off. The spam window controls the time period being watched, max messages controls the limit inside that period, and muted words blocks messages that contain listed words.

## Logs and Reports

HMD users can review the same operational logs available to admins. Logs include account requests, login blocks, uploads, shutdown events, moderation events, and other important server actions.

## Shutdown Access

Shutdown mode lives in the Admin server panel, but it is part of emergency operations. When shutdown is on, normal member sessions are kicked and member logins are blocked. Admin, admin2, hmd, dev, and other admin/HMD/dev-role accounts can stay connected and restart the server.

## Persistence

Accounts, messages, uploads, HMD settings, logs, and profiles are saved under the configured data directory for local desktop use. On Render Free, set `MONGODB_URI`; JSON records are saved to MongoDB and uploaded file bytes are saved to GridFS so they survive redeploys.
