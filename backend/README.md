# LifeLink backend

LifeLink is a blood-donor coordination prototype for The Gambia. Phases 1-10 provide donor accounts, approved facilities/staff, verified profiles, consent-based location, private compatibility/geospatial matching, legitimate blood requests, in-app notifications, donor responses, facility-confirmed donations, fulfilment, operational matching pause and administration/audits.

**This is not medical certification, government approval or production authorization.** Healthcare professionals remain responsible for assessment, blood screening, collection, crossmatching and transfusion. Verification is not medical clearance; compatibility is candidate filtering; location freshness does not prove presence; pause expiry is not medical clearance.

## Architecture and documentation

Node.js 22.12+, 24.x or 26+, Express 5, ES modules, MongoDB/Mongoose, Zod, bcryptjs, JWT, Helmet, CORS and express-rate-limit. Modular monolith: routes authenticate/validate; thin controllers shape HTTP; services enforce domain/ownership rules; models/indexes and transactions preserve integrity.

- [Architecture, relationships, lifecycles and indexes](docs/ARCHITECTURE.md)
- [Complete OpenAPI specification](docs/openapi.json)
- [Security/privacy review and limitations](docs/SECURITY_REVIEW.md)
- [Exact phase verification ledger](docs/PHASE_RESULTS.md)
- [Final completion report and full folder structure](docs/FINAL_REPORT.md)
- [Historical development notes](docs/DEVELOPMENT_HISTORY.md)

GET /api/v1/docs/openapi.json serves the specification as raw OpenAPI JSON. It documents every supported operation; there is no public arbitrary donor matching/search endpoint. No frontend was built or modified.

## Setup

Use a supported Node.js version and MongoDB Atlas or a replica set. Standalone MongoDB is rejected at startup because important writes require transactions. Run inside backend:

```powershell
npm.cmd install
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Do not overwrite an existing .env. Set JWT_SECRET to the generated value and configure MONGODB_URI and explicit CORS origins. Never commit .env or real credentials. The test MongoDB binary is not a production database installation.

For a NEW loopback-only local development database (mongod and mongosh must be installed separately):

```powershell
New-Item -ItemType Directory -Path .local-mongo -Force
mongod --dbpath .local-mongo --replSet lifelink-rs --bind_ip 127.0.0.1
```

Keep it running. In mongosh, initialize this new replica set once:

```javascript
rs.initiate({_id:'lifelink-rs', members:[{_id:0, host:'127.0.0.1:27017'}]})
```

Then use `mongodb://127.0.0.1:27017/lifelink?replicaSet=lifelink-rs`. Do not conflict with an existing MongoDB service or reinitialize an existing deployment. This example has no production database authentication or failover; protect production networking, database users, TLS and secrets separately.

## Environment

| Variable | Requirement/default |
|---|---|
| NODE_ENV | development, test, production; default development |
| PORT | 1-65535; default 5000 |
| MONGODB_URI | Required MongoDB URI, transaction-capable deployment |
| JWT_SECRET | Required random secret, at least 32 characters; distinct per environment |
| JWT_EXPIRES_IN | Positive integer + s/m/h/d, at most one day; default 1h |
| CORS_ORIGINS | Comma-separated explicit HTTP(S) origins, no trailing slash; default http://localhost:3000 |
| DONOR_LOCATION_MAX_AGE_MINUTES | Integer 1-10080, default 60 development minutes |
| MATCH_RADIUS_STAGES_KM | Ascending unique decimal radii; default 5,10,20,40; at most 10 stages, each >0 and <=500 km |
| BLOOD_REQUEST_MAX_LIFETIME_HOURS | Integer 1-720, default 72 operational hours |
| DONATION_MATCHING_PAUSE_DAYS | Integer 1-365, default 56 development days; platform policy only |
| BROADCAST_RATE_LIMIT | Integer 1-1000; default 20 operations per staff account per 15 minutes |

Production values for freshness, radius, request lifetime, unit conventions and pause require platform/health-authority review; defaults are not official Gambian policy. No SMTP/SMS/WhatsApp/push configuration is claimed or implemented.

```powershell
npm.cmd run dev
npm.cmd start
npm.cmd test
npm.cmd run check
npm.cmd audit
npm.cmd run docs:generate
npm.cmd run docs:check
```

The HTTP server binds to 127.0.0.1. Review production host/reverse-proxy/TLS settings deliberately. Trust proxy is disabled by default; never blindly trust forwarded headers. Startup validates environment, connects to MongoDB, checks replica/sharded topology and initializes indexes before listening. Health returns 503 when the DB disconnects. SIGINT/SIGTERM close HTTP connections and MongoDB.

## Administrator and facility onboarding

```powershell
npm.cmd run bootstrap:admin
```

Use a real interactive terminal. Enter administrator identity and a hidden password twice. No hardcoded administrator, public bootstrap endpoint, CLI password argument or printed password exists. A transactional singleton permits only initial bootstrap and refuses if any admin already exists, including inactive ones. It is not account recovery. Afterward log in through /auth/login. No real administrator was created during automated development.

Admin creates a PENDING facility, reviews/approves it, sets its official location, and explicitly provisions FACILITY_USER staff. Default staff permission is VERIFY_DONORS only; opt into CREATE_BLOOD_REQUESTS, MANAGE_BLOOD_REQUESTS and/or CONFIRM_DONATIONS as needed. Staff have at most one facility. Administrative reference fields/categories do not assert official licensing rules. Staff passwords currently require secure out-of-band delivery and there is no invitation/reset flow.

Anyone can register as DONOR without prior testing. Public ADMIN/FACILITY_USER registration and mass-assigned privilege fields are rejected. Before matching, approved authorized staff verify profile/blood type and record provenance/history. Admin controls suspension/reverification but cannot directly mark a blood type verified.

For old Phase 1 data, back up first, then optionally run `npm.cmd run migrate:phase2`. It only backfills missing donorVerification as UNVERIFIED, preserves existing verified records/IDs and is idempotent. Later fields have conservative defaults; no production data was migrated automatically.

## Donor privacy and availability

New donors default UNAVAILABLE and sharing=false, without coordinates. Availability and consent are independent. A donor can configure both while still unverified. Device clients obtain location automatically after permission; product users should not manually type coordinates. PUT /donors/me/location accepts only strict GeoJSON Point with [longitude,latitude], finite numeric longitude -180..180 and latitude -90..90. No fake [0,0] default exists; a deliberate valid [0,0] is accepted.

Upload requires existing consent and generates a database-server timestamp. Disabling sharing or DELETE location atomically revokes consent and removes coordinates/timestamp, preserving availability. A racing upload cannot resurrect location after revocation. Only the donor's self-location API selects/returns exact coordinates; general queries, JSON serialization, auth, verification, histories, audits and facility views exclude donor GPS. No movement-history collection, tracking job or donor map exists. Live-record deletion does not promise erasure from existing backups or client copies; retention governance remains necessary.

Freshness is derived: valid location and timestamp, age >=0 and <=configured maximum. Exact threshold is fresh; invalid/future timestamps fail closed. locationReady adds active DONOR, AVAILABLE and consent. It does not include blood verification or compatibility and is never full matching eligibility.

## Compatibility and private matching

The centralized red-cell coordination table is:

| Recipient | Potential donor groups |
|---|---|
| O- | O- |
| O+ | O-, O+ |
| A- | O-, A- |
| A+ | O-, O+, A-, A+ |
| B- | O-, B- |
| B+ | O-, O+, B-, B+ |
| AB- | O-, A-, B-, AB- |
| AB+ | O-, O+, A-, A+, B-, B+, AB-, AB+ |

**LifeLink compatibility filtering is for donor coordination and does not replace clinical compatibility testing, crossmatching, donor screening, or professional transfusion decisions.** It is not a whole-blood/plasma rule.

createMatchingService(config) exposes internal findCandidates and findCandidatesProgressively. Both defensively validate blood group, GeoJSON, limits and optional trusted Date. MongoDB $geoNear uses currentLocation_2dsphere and server-time freshness/pause predicates. Eligible candidates must be active DONORs, VERIFIED with compatible verifiedBloodType, AVAILABLE, consented, valid/freshly located, within radius, and outside the confirmed-donation platform pause. Scalar-type guards reject malformed raw data. No eligibility boolean/result is persisted or cached.

Distances are meters, sorted nearest then donor ID. Limit/target default 20, maximum 100; radius maximum 500 km. Progressive stages replace cumulative results rather than concatenating duplicates; each stage re-reads current state, with one coherent evaluation time per call. A bounded internal exclusion list prevents renotification. The returned candidate has exactly donorId, verifiedBloodType and distanceMeters. No contact/coordinates are returned. Results are observations, not reservations; later privileged actions revalidate.

## Request to notification to donation

Approved staff with CREATE_BLOOD_REQUESTS create requests using patientBloodType, unitsNeeded (integer 1-100), urgency (staff-supplied CRITICAL/URGENT/PLANNED) and future bounded expiresAt. No patient identity, diagnosis or arbitrary request location is accepted. The request snapshots the official facility location. unitsReceived begins at zero and cannot be directly edited. Staff read only their facility's requests; admins have deliberate administrative reads.

OPEN and PARTIALLY_FILLED are active only before expiry. Read models derive EXPIRED immediately; optional internal expireRequests persists it, but cron is not required for correctness. Owning MANAGE_BLOOD_REQUESTS staff may cancel an active request with a bounded reason. Terminal statuses cannot be arbitrarily reopened or edited.

A broadcast needs an active owned request and UUID idempotencyKey. It starts at the smallest configured radius; explicit expand=true permits the next stage. Matching excludes previously notified donors, with at most 100 selected per operation and 1000 recipients per request. One IN_APP notification per request/donor is enforced uniquely. Same key returns its original result; radius conflicts require reloading, not blindly repeating expansion.

GeoNear runs outside the transaction (MongoDB restriction), then the transaction locks the owned request/staff/facility and rechecks at most 100 selected donors, including current distance, consent, freshness, verification and pause. Notifications and broadcast state commit together. IN_APP DELIVERED means a persistent inbox record exists, not a device receipt. READ is explicit. External providers throw CHANNEL_NOT_CONFIGURED rather than pretending to deliver.

Donors read only their inbox, including their derived PENDING/ACCEPTED/DECLINED response status. A notified active donor can accept or decline while the request/facility remain active. Acceptance rechecks critical eligibility and can submit fresh location without enabling consent. First response is final; identical retries are idempotent, changing it is rejected. A future withdrawal workflow is needed; for now changes after acceptance require direct facility coordination. Accepted active/currently verified compatible donors may reveal minimal name/phone to owning management staff on active requests; declined/closed/inactive/suspended donor records do not reveal contact. No email/GPS is returned.

Acceptance is not donation. Only owning CONFIRM_DONATIONS staff confirm an accepted active verified donor's actual donation. One immutable event per request/donor records staff/facility/time, verified blood-type snapshot and units. Units are integer 1-4, cannot exceed remaining request need, and are coordination records, not safe-collection prescriptions. Identical retries are idempotent even after fulfilment. Donation/history, received units, partial/full status, fulfilledAt and lastConfirmedDonationAt commit together. Competing confirmations cannot overfill a request.

Confirmed records drive donor self-history and minimal facility/admin histories. Availability is preserved. Matching/acceptance derive the configured post-donation pause from private lastConfirmedDonationAt; exact expiry permits matching only if all other requirements hold. Invalid/future donation timestamps fail closed. The timer never grants medical clearance. Already accepted actual donations can still be recorded without treating consent/availability or the timer as clinical rules.

## Administration, audit and security

ADMIN can update explicit staff permissions, deactivate/reactivate accounts, read safe audits and get seven aggregate counts. Structured account reasonCode avoids copying free text into audits. Self-deactivation and last-admin lockout are protected, including ID-case and concurrency attacks. Status changes increment session version; earlier tokens stay invalid after reactivation. Legacy tokens without a version are accepted only for unchanged version-zero accounts until their normal expiry.

Sensitive actions write append-oriented AuditLog events inside the same transaction. Allowed metadata is limited to structured states/counts/permissions/reason codes; no passwords, tokens, exact coordinates, body dumps, contact data or verification notes. Normal API/model mutation of audits, verification events and donations is blocked. Direct database operators remain privileged; history is not cryptographically tamper-proof. Existing pre-audit actions are not fabricated retroactively.

Passwords use bcrypt cost 12 with a 72-UTF-8-byte maximum. JWT uses HS256, issuer/audience checks, required issue/expiry claims, maximum one-day lifetime, future-issue rejection and fresh active-account/session-version checks. Helmet, explicit CORS, 16 KB JSON body limit, no-store responses, strict Zod bodies/IDs/filters and safe errors remain enabled. Global in-memory limits are 200 API requests and 20 combined login/register attempts per IP per 15 minutes; broadcast has the separate configurable per-staff limit. Review these single-process limits, trusted proxy behavior and shared hospital networks before pilot deployment.

Normal success is {success:true,data:...}; errors are {success:false,error:{code,message,details?}}. No raw MongoDB errors/stacks are returned, including in production. Database network/selection failures map to 503; resource conflicts map to 409. NoSQL operators, unknown privilege fields and malformed coordinates/IDs are rejected.

## Testing, scope and deployment

Tests derive URIs only from disposable local MongoDB replica sets, never configured deployment databases. A local ignored .test-tools/mongod.exe is reused, otherwise a test binary downloads on first run. Tests cover all original authentication/location/verification behavior, the entire 64-pair compatibility matrix, real geospatial explain/index behavior, ownership/privacy, expiry, idempotency, transactions/rollback and concurrency. See PHASE_RESULTS and FINAL_REPORT for exact executed results; no production database was migrated or external message sent.

OpenAPI validation is executable with docs:check. docs:generate regenerates docs/openapi.json from the maintained declarative catalog; tests compare all 43 operations against actual routers and security metadata. OpenAPI 3.0 describes position-specific coordinate constraints textually because tuple-position bounds are not expressible in its items schema; Zod enforces them exactly at runtime.

This is a tested development/staging prototype, not a medical/government-approved national deployment. Before a real pilot: agree on clinical verification/compatibility/unit/pause policies; validate staff/facility licensing evidence; complete privacy/consent/retention governance; add operational monitoring/backups/recovery, load testing and independent security review; review transaction timeouts and pagination/count costs at scale. Password recovery, invitations, donor withdrawal, auditable donation correction, retention automation and external delivery providers remain unimplemented. TLS/network/database permissions/secrets and local MongoDB installation need manual configuration. Do not expose the loopback development example as a production database.

Phases 5-10 are complete within this scope. Frontend development is not authorized by this work; stop and obtain approval before creating/modifying it.
