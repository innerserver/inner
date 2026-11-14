# Connectifi v245 security hardening

This release reduces concrete security and resource-exhaustion risks. It cannot guarantee uninterrupted service or protection against every attack.

## Changes and effects

- Replaced the handwritten WebSocket frame parser with `ws`. Handshakes, masking, UTF-8, fragmentation, control frames and a 1 MiB message limit are enforced by the library. Existing application messages and WebRTC signaling retain their format. Compression is disabled.
- Live WebSocket and HTTP fallback clients are bound to their creating session. Logout, account-session revocation and expiry disconnect them. A second account or session cannot take over an existing HTTP client identifier. Password changes revoke existing sessions, requiring sign-in again. Each account retains at most ten sessions.
- WebSocket messages are processed in order. A connection permits 600 messages per ten seconds, with at most 256 queued messages and 4 MiB of queued input/output. Over-limit connections disconnect so they cannot grow memory without bounds. These are application limits, not network-level DDoS protection.
- Unsafe browser-origin API requests are rejected before login as well as after authentication. Origin checks compare the scheme and host. Authenticated writes still require the existing CSRF token. Malformed percent-encoded cookies no longer cause server errors.
- Account endpoints have a per-IP limit before parsing bodies or hashing passwords. Default: 600 requests per minute to accommodate shared school networks. `INNER_AUTH_IP_REQUEST_LIMIT` adjusts it. Existing username/IP failed-login cooldowns remain. Rate maps are bounded and expired entries are removed.
- Public password reset requests send at most one message per account every five minutes, including username/email aliases. Reset links reject invalid expiry values and cannot be completed concurrently in the same server process. A link is consumed before its password update; if storage then fails, request a new link. Persistent sessions and reset claims currently assume one app instance, as did the existing session implementation.
- Request-triggered password hashing runs asynchronously, with at most eight active operations and credentials limited to 1,024 characters. Existing password hashes remain compatible. Busy requests receive 503 rather than creating an unlimited hashing queue. Startup-only default credential initialization is unchanged.
- JSON endpoints require an object, accept at most 1 MiB and have a 30-second body deadline. HTTP headers have a 15-second deadline and request bodies a 120-second deadline. Interrupted requests are handled without writing a second response.
- Uploads are limited to three concurrent requests per account and sixteen server-wide. Existing extension, MIME/magic-byte, size and download-access checks remain. Partial local uploads are cleaned up on interruption or timeout, and new local upload/JSON files use owner-only permissions on POSIX systems. Files remain outside the public directory. Signature checks are not malware scanning or complete file-format validation.
- The browser proxy rejects non-public IPv4/IPv6 addresses, including alternate IPv4-mapped IPv6 spellings. DNS results are checked again at connection time. Redirects share a ten-second overall deadline and each destination is checked against the browser policy. The existing 4 MiB response limit remains. There are at most eight active proxy fetches and thirty requests per account per minute.
- Proxied remote documents receive a CSP sandbox without script execution or same-origin privileges. Remote scripts and forms do not work inside that preview; this prevents remote HTML or SVG from gaining Connectifi's origin. Open complex interactive sites directly when needed.
- AI requests have a twenty-second deadline and reject redirects. The existing provider-host allowlist remains.
- A configured MongoDB outage no longer falls back to stale local accounts or permissions. Startup stops if the configured database cannot connect; runtime database failures return 503. Public health responses hide internal storage error details. Deployments without a configured MongoDB retain their existing local mode. B2 file storage is unchanged and is separate from the account database.
- Updated Nodemailer to a fixed release and added locked versions of the new runtime dependencies. The production dependency audit reported zero known vulnerabilities at the release check. This is not evidence that the whole app has no vulnerabilities.

## Runtime and hosting

Node.js 24 is declared in `package.json` and `render.yaml`. If the existing Render service has an explicit `NODE_VERSION=20` dashboard override and is not synchronized from the Blueprint, change that override to `24` before deployment. Git pushes alone do not confirm the deployed Node version.

`INNER_TRUST_PROXY=true` is declared for Render and defaults on when Render supplies its platform environment flag. Standalone servers ignore forwarded headers by default. Only enable proxy trust when direct public access to the Node listener is prevented and the nearest proxy appends/replaces forwarded headers. With multiple proxy layers the nearest upstream address may represent a proxy, so verify the hosting chain before relying on IP limits for individual users.

Application limits and session revocation are per process. Multiple replicas need shared sessions, rate limits and atomic database reset-token claims before scaling out. Network floods, hosting outages and compromised provider accounts also require hosting controls, protected backups and account security. Those infrastructure settings were not changed in this release.

## Verification

`npm run test:security` runs isolated local HTTP/WebSocket and function regressions using temporary fixtures. It does not access production accounts or launch/control Chrome. The suite covers origin/CSRF boundaries, malformed input, bounded rate/hashing work, session/client isolation, WebSocket framing and signaling, private proxy targets, redirect deadlines, document sandboxing, database failure behavior, reset replay and upload restrictions.

No UI, sidebar, existing admin account, stored password, B2 credential, mail route or browser setting was changed as part of this release. A production screen-sharing media test was not run; the local signaling regression checks message delivery only.

Security references: [WebSocket library documentation](https://github.com/websockets/ws/blob/master/doc/ws.md), [Node.js HTTP limits](https://nodejs.org/api/http.html), [OWASP denial-of-service guidance](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html), [Node.js release lifecycle](https://nodejs.org/en/about/previous-releases).
