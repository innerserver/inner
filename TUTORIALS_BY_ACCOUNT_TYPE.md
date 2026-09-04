# Inner Tutorials by Account Type

Use this file as the quick onboarding guide for new users. The app also shows a role-based guide on the Dashboard after login.

## Before Creating an Account

1. Open Inner.
2. Press **Request account** in request mode or **Create account** in open signup mode.
3. If the browser asks for location, choose **Always allow**.
4. Fill in username, real display name, email, phone, grade, and password.
5. If open signup is enabled, the account is created as a normal member.
6. If request mode is enabled, the user waits on the review screen until an admin approves or declines the request.

Location permission is used for server allocation and admin review. If a browser blocks it, Inner still records normal IP/device details.

## Member / Student

1. Dashboard: read announcements, check the current server status, and use **Show guide** if the tutorial was dismissed.
2. Profile: set display name, profile picture, grade, email, phone, bio, status, and theme. Save this before using Friends.
3. Friends: choose a grade to see same-grade candidates, pick a person, press Add friend, then wait for them to accept. Search exact username to find someone outside your grade.
4. DMs: create direct messages or group chats with accepted friends only. Use the + menu for attachments, photos, appearance, secret messages, groups, and link/doc sharing.
5. Calls: open a DM/group, press Call or Video, and have the other person press Answer. Camera/mic require HTTPS or localhost.
6. Screen share: use Share screen from a selected DM/group. Screen sharing needs desktop-class browser support; some phones cannot start screen share.
7. Messages: chat in rooms, reply/react without losing your typing area, and use the jump-to-bottom button when needed.
8. Files: upload public or private files. Private files are visible to the uploader and admins.
9. Google Workspace: use the one Workspace tab to switch between Docs, Slides, and Sheets, create work, and share links with friends.
10. Browser: open allowed sites inside Inner and send the current link to accepted friends or groups.

## Moderator / Teacher

1. Dashboard: start from announcements and the role guide.
2. Messages and DMs: help keep chats clean.
3. Friends: use grade search for same-grade/staff groups and exact username for anyone outside the grade.
4. Calls and screen share: use DM/group Call, Video, and Share screen; desktop Chrome/Edge is best for screen sharing.
5. Reports: review reported content if the owner/admin gives access.
6. Users: teacher/moderator accounts should not be created through open signup. Admins assign moderator role manually.
7. Google Workspace: use the one tab for class docs, slides, sheets, and shared materials.

## Admin

1. Admin > Server: set room name, signup mode, report emails, and server power.
2. Admin > Accounts: public admins appear first. Search or press **Show all** to view other accounts. Use grade filter for grade-based review.
3. Friends support: make sure users have the correct grade saved on their account/profile if grade search looks empty.
4. Calls support: configure TURN for reliable calls across different networks. Set INNER_TURN_URLS, INNER_TURN_USERNAME, and INNER_TURN_CREDENTIAL.
5. Admin > Account requests: approve, review, or decline requests. Old approved/declined requests are cleaned up by the server.
6. Admin > Announcements: send global or room-specific announcements that show on Dashboard.
7. Admin > Feature visibility: hide tabs completely from normal users, then allow specific users where needed.
8. Admin > Feature locks / Paywalls: disable, lock, or paywall app areas.
9. Admin > Logs and reports: search by account/day, export logs, wipe selected log areas, and mark reports done.
10. Admin > Backups: create backups and rollback/reinstate from saved backups.
11. Admin > Browser / Apps: manage custom app links, browser permissions, Chess link, Google Docs, Slides, and Sheets access.
12. Admin > Scaling: review service categories, links, rough monthly costs, and scaling notes.

## HMD / Dev

1. HMD > Metrics: inspect live server, database, storage, and app health snapshots.
2. HMD > Emergency tools: use shutdown/restart carefully. Shutdown kicks normal users out and keeps owner/admin/HMD access.
3. HMD > Calls: check WebRTC/TURN environment values when calls work locally but fail across networks.
4. HMD > Localhost tools: use local boot/helper tools when running Inner on the desktop/local version.
5. HMD > Bots/plugins/AI: prepare automation, moderation, and AI tool configuration.
6. HMD > Storage/database: inspect persistence status and upload backend information.

## Mobile App Instructions

### iPhone

1. Open Inner in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Open Inner from the new home-screen icon.
5. Use the three-line menu button to open or close the sidebar.

### Android

1. Open Inner in Chrome.
2. Tap **Install app** or the browser menu.
3. Choose **Add to Home screen**.
4. Open Inner from the app icon.
5. Use the three-line menu button to open or close the sidebar.

## Notes

- Admin, HMD, and Domain tabs are hidden from normal users.
- Hidden features are also removed from normal sidebars unless the owner/admin allows a specific user.
- Open signup always creates a normal member. Teachers/moderators are assigned manually by admins.
- Users can only friend people in their grade unless they search exact username.
- Dark, Midnight, Slate, Glass, and Custom themes should keep app text readable across panels, forms, DMs, and menus.
- After logout on phone, the login and request forms should stay scrollable and readable.
