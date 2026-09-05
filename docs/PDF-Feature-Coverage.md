# Inner PDF Feature Coverage

This build includes the PDF feature set as working app features or production-ready foundations. Browser calling features still require HTTPS plus real TURN credentials in deployment.

## Added In This Rebuild

- Admin account search by username, role, source IP, device, contact, ban reason, and profile text.
- Admin system log search by account, action, IP, device, details, and exact day.
- System log JSON export.
- Moderation log JSON export.
- Friend-only direct messages for members.
- Friend-only group DM creation for members.
- Group DM delete for the creator or admins.
- Invite-only room invite creation from Room manager.
- Invite code/link copy flow.
- Invite join box in the Messages view.
- Invite URL auto-join with `?invite=CODE`.
- HMD localhost tools showing loopback URL, LAN phone URLs, data folder, upload folder, storage mode, and cloud requirement.
- Admin service scaling controls for messages, DMs, uploads, voice, screen share, notifications, moderation, and realtime.
- Upload scale now adjusts maximum upload size.
- Message scale now adjusts automod rate-limit capacity.
- Room manager now shows public/private/invite-only and allowed users.
- DM/group UI is friendlier and explains accepted-friend rules.

## PDF Coverage

- Advanced message system: instant optimistic sends, retries, live edits, live deletes, replies, reactions, mentions, attachments, offline queue foundation.
- No-scroll-jump system: preserved chat scroll during message updates, reactions, edits, deletes, reports, and live updates.
- Go-to-bottom system: jump button and scroll restore foundations.
- Open to last read: scroll position restore and read receipt foundations.
- Cloudinary storage: Cloudinary upload pipeline, local fallback, Mongo/GridFS fallback, and cloud-required mode.
- Upload security: MIME/extension/signature checks, dangerous executable blocking, private file visibility, delete support, and previews.
- Live notifications: socket notifications, mentions, DMs, calls, room updates, ringtone/sound foundation.
- Reactions: default reactions, supportive reactions, counts, partial update behavior.
- Report system: message/media/user report foundation, moderation queue, email prep, IP/device/location metadata.
- AI moderator system: AI helper, automod rules, moderation queue/log foundation. Full AI video/image scanning requires API/provider wiring.
- Room management: public/private/invite-only rooms, permissions, invites, delete, backup-oriented room reset.
- Call system: voice, video, group/DM calls, ringtones, reconnect handling, mute/deafen/camera controls.
- Screen share system: room, DM, and group screen share with recovery/reconnect hooks.
- Realtime stabilization: heartbeat, reconnect, websocket outbox, missed-event/state reload foundations.
- Admin dashboard: user lookup, room controls, upload manager, DM review, backups, feature locks, service scaling, server shutdown.
- Logging system: system logs, moderation logs, account/upload/report/server events, search, export, wipe utility.
- Wipe utilities: wipe logs, reports, uploads, reset rooms with backup.
- Profile system: pictures, banners, bios, statuses, custom statuses, badges, themes, invisible mode.
- Appreciation features: supportive reactions, helpful/funny/supportive reaction set, profile badges foundation.
- Community features: announcements/polls/pins are planned hooks; message replies/reactions/mentions are working.
- Soundboard system: synced built-in soundboard buttons in calls/rooms; custom searchable sound uploads are foundation/planned.
- Sound moderation: admin upload/file controls and automod foundations.
- Theme system: dark themes, per-profile themes, global HMD theme, glass theme toggle.
- Anti-alt system: IP logging, device/browser logging, contact/location-required signup/request validation, anti-abuse metadata.
- Persistence engine: JSON local persistence, Mongo persistence, Cloudinary/GridFS upload persistence, sessions, message queues, backups.

