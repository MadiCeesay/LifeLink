# Security and privacy review

This is an engineering review with automated adversarial tests, not medical certification, independent penetration testing, government approval or production authorization.

## Findings addressed

1. Acceptance with a fresh GPS payload originally reloaded a user without the private last-confirmed-donation timestamp. The refresh projection now includes it and an adversarial test proves GPS refresh cannot bypass the platform pause.
2. Administrator self-ID checks were case-sensitive. Canonical comparison now blocks uppercase-hex self-deactivation, including where a second admin exists.
3. Tokens lacking expiry could otherwise be verified by the JWT library. Signed tokens now require valid issue/expiry claims, <=one-day lifetime, HS256/issuer/audience and reasonable issuance time. Tests cover alternate/none algorithms, absent expiry, excessive lifetime and future issuance.
4. Account reactivation could revive earlier tokens. Status changes increment tokenVersion; old sessions stay invalid. Legacy versionless tokens are accepted only for version-zero accounts. Fresh login is required after a status change.
5. Accepted contact views now filter current active, VERIFIED compatible donors as well as active owned requests; inactive/suspended/incompatible and declined/closed contacts are withheld.
6. Broadcast operations have a dedicated per-authenticated-staff limit in addition to existing global/auth limits. Unknown payload fields, arbitrary coordinates, cross-facility targets and duplicate wave/request operations fail closed.
7. Duplicate-key errors are no longer universally mislabeled email collisions. Non-email conflicts use RESOURCE_CONFLICT; network/selection/closed-connection errors return safe 503 envelopes without raw MongoDB details.
8. Empty audit metadata is explicitly preserved; audit tests select intended events rather than relying on unspecified query order.
9. Final audit closed a read-model gap: donor inbox/read results expose only that donor's derived responseStatus so state can be recovered across app sessions. This adds no new search or contact capability.

## Verified boundaries

- All original Phase 1-4 tests preserved; new unit/integration tests use disposable replica sets only.
- Exact donor GPS only through active donor self-location. MongoDB matching projects only ID/blood type/distance. No public arbitrary matching/nearby directory route.
- Public registration cannot set role ADMIN/FACILITY_USER, facility, active state, verification, token version or arbitrary model fields.
- Facility/user status, explicit permission and owner scope are checked in services and rechecked in transactions. IDOR/cross-role/cross-facility tests include requests, notification ownership, response/confirmation and admin resources.
- Contact only in accepted active-request coordination; no candidate contact list, donor email directory, coordinates in audit, or unbounded document dumps.
- Immutable histories have no update/delete APIs. Critical multi-document writes include audit events and rollback on injected persistence failures.
- Real concurrency tests cover donor verification/facility suspension, consent revocation, duplicate broadcast/response/confirmation, cancellation races, admin status races and request overfill.
- Strict Zod schemas reject operator objects, prototype fields, unknown keys, unsafe pagination, malformed IDs, numeric strings, NaN/Infinity/null coordinates and mass assignment.
- 16 KB body limit, Helmet, explicit CORS, no-store responses and single-process global/auth/sensitive rate limits remain enabled. Forwarded headers are not blindly trusted.
- No external provider is faked. IN_APP is a database inbox; external channels explicitly fail as unconfigured.

## Final scan and residual risks

Production source is scanned for TODO/FIXME, console debug, password123, disabled TLS checks, jwt.decode, eval and $where markers. Normal startup logs and sanitized error class names are intentional; request bodies, password/JWT/coordinates are not logged. Fixed secrets/passwords in disposable tests and fictional documentation examples are not production credentials.

Limits requiring manual review: no password recovery/invitations/forced initial password change, no external channel reliability/outbox, no donor withdrawal or donation correction workflow, no automated retention/backup erasure, no consent-grant evidence beyond donor-controlled flags, no GPS attestation, no independent load/security assessment. Global IP limits must be reviewed for hospital shared networks/proxies. In-memory limits reset on restart. Broad geo queries/counts and bounded per-donor transactional guards require representative load testing.

Clinical/governance review must define approved facility/staff evidence, verification procedure and re-verification policy, candidate compatibility restrictions, product/unit conventions, expiry/radius/freshness/notification/pause settings, suspicious-request moderation procedures, consent/retention/access review and lawful external communications. Operational pause expiry and VERIFIED status never establish medical eligibility or blood safety.
