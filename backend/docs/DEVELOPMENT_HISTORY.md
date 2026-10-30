# Historical implementation notes

These are chronological development notes, superseded by the current README, architecture and OpenAPI specification. Phase-specific statements describe that stage, not the final backend.

# LifeLink backend - Phases 1 through 4

LifeLink is a national blood-donor coordination concept for The Gambia. Phase 1 provides identity/authentication. Phase 2 adds administrator-managed healthcare facilities, staff permissions and traceable donor verification. Phase 3 adds consent-based donor location and availability. Phase 4 adds an internal compatibility and private geospatial candidate-discovery engine. Frontend, blood requests, notifications and donations are not implemented; no HTTP matching/search endpoint exists.

**LifeLink donor verification does not replace medical donor screening or blood testing at the time of donation.** VERIFIED records the platform profile/blood-group verification workflow; healthcare professionals remain responsible for actual assessment, collection, testing and transfusion. It does not certify medical eligibility or blood safety.

## Technology and architecture

Node.js 22.12+, 24.x, or 26+, ES modules, Express 5, Mongoose 8, MongoDB, Zod, bcryptjs, JWT, Helmet, CORS and express-rate-limit. ESLint checks source; Vitest/Supertest and mongodb-memory-server exercise real MongoDB transactions on disposable one-node replica sets.

Routes compose authentication/authorization and validation. Thin controllers use services for domain rules. Dedicated response views never dump documents. User belongs to at most one Facility; VerificationEvent records each donor transition separately. AdminBootstrap is an internal singleton ensuring initial-administrator creation is safe under concurrency.

```text
backend/
  scripts/
    bootstrap-admin.js
    migrate-phase2.js
  src/
    config/
      database.js
      domain.js
      env.js
      initializeDatabase.js
      matching.js
    controllers/
      authController.js
      facilityController.js
      locationController.js
      verificationController.js
    middleware/
      auth.js
      errorHandler.js
      facility.js
      validate.js
    models/
      AdminBootstrap.js
      Facility.js
      User.js
      VerificationEvent.js
    routes/
      adminRoutes.js
      authRoutes.js
      donorRoutes.js
      facilityRoutes.js
    services/
      authorizationService.js
      authService.js
      bootstrapService.js
      compatibilityService.js
      facilityService.js
      locationService.js
      matchingQuery.js
      matchingService.js
      verificationService.js
    utils/
      errors.js
      locationState.js
      parseInput.js
      views.js
    validators/
      account.js
      auth.js
      facility.js
      location.js
      matching.js
      verification.js
    app.js
    server.js
  tests/
    helpers/database.js
    auth.test.js
    phase2.test.js
    locationState.test.js
    phase3.test.js
    compatibility.test.js
    matchingConfig.test.js
    matching.test.js
  .env.example
  .gitignore
  eslint.config.js
  package.json
  package-lock.json
  README.md
  vitest.config.js
```

Ignored runtime directories: node_modules/, .npm-cache/, .test-tools/. The latter contains a locally downloaded official MongoDB executable plus download/debug artifacts and is never source-controlled.

## Setup and database requirement

Run commands from `C:\Users\Admin\Desktop\LifeLink\backend`:

```powershell
npm.cmd install
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Do not overwrite an existing .env. Set JWT_SECRET to the generated value. Use your own replica-set database URI and explicit frontend CORS origins. MongoDB Atlas is suitable. A standalone MongoDB server is no longer sufficient: Phase 2 deliberately requires transactions. Startup checks topology and initializes all indexes before accepting HTTP traffic.

For a new local development database, one possible setup (MongoDB binaries must be installed separately):

```powershell
New-Item -ItemType Directory -Path .local-mongo -Force
mongod --dbpath .local-mongo --replSet lifelink-rs --bind_ip 127.0.0.1
```

Keep mongod running. In another terminal, run `mongosh` then initialize the new replica set once:

```javascript
rs.initiate({_id: 'lifelink-rs', members: [{_id: 0, host: '127.0.0.1:27017'}]})
```

Set MONGODB_URI to `mongodb://127.0.0.1:27017/lifelink?replicaSet=lifelink-rs`. This loopback-only example is for local development; production database authentication/network protection must be configured separately. Do not run it over an existing MongoDB service on the same port. A one-node replica set supports transactions but provides no failover redundancy.

| Environment variable | Purpose |
|---|---|
| NODE_ENV | development, test or production; default development |
| PORT | 1?65535; default 5000 |
| MONGODB_URI | Required mongodb:// or mongodb+srv:// URI supporting transactions |
| JWT_SECRET | Required random secret, at least 32 characters |
| JWT_EXPIRES_IN | Positive integer + s/m/h/d, at most one day; default 1h |
| CORS_ORIGINS | Comma-separated explicit HTTP(S) origins, no trailing slash |
| DONOR_LOCATION_MAX_AGE_MINUTES | Freshness window, integer 1-10080; default 60 minutes |
| MATCH_RADIUS_STAGES_KM | Ascending unique decimal radii in km; default 5,10,20,40; max 10 stages, each >0 and <=500 |

No new environment variable is required for Phase 2. The database user must be able to read/write the collections and initialize required indexes. The API binds to 127.0.0.1; production binding, TLS and reverse-proxy configuration require deliberate deployment setup. Trust proxy stays disabled by default.

```powershell
npm.cmd run dev
npm.cmd start
npm.cmd test
npm.cmd run check
npm.cmd audit
```

Startup fails without a usable database or transaction-capable topology. Health returns 503 when the database is disconnected. SIGINT/SIGTERM close HTTP connections and disconnect MongoDB.

## Initial administrator bootstrap

There is no public administrator creation endpoint, hardcoded admin password or default admin account.

```powershell
npm.cmd run bootstrap:admin
```

Run from a real interactive terminal with the backend .env configured. Enter name, email, phone and a password (hidden, entered twice). Passwords require 12+ characters and at most 72 UTF-8 bytes. Neither password nor token is printed or accepted as a command-line argument. The CLI uses the same input validation and bcrypt cost as normal accounts.

Bootstrap creates one ADMIN only if no ADMIN already exists, including inactive administrators. A transactional singleton marker prevents concurrent or later repeated bootstrap. It is not an account-recovery tool. Do not delete the marker to create more admins. Use /auth/login after bootstrap. No production account or admin was created during automated development.

## Account registration versus verification

Anyone may register as DONOR without a blood test. Registration and login stay as Phase 1. A new donor's donorVerification.status is UNVERIFIED. Self-reported blood type is intentionally not supported in Phase 2: registration rejects blood-type/verification fields. verifiedBloodType can be set only by the authorized verification service.

An unverified donor must never enter a future matching pool. Phase 2 does not implement that pool or expose a matching-eligible boolean. Future matching must explicitly require an active DONOR with status VERIFIED and trusted verifiedBloodType, plus later availability/location/platform checks. Never infer eligibility from a populated blood type alone.

## Facility lifecycle and staff

Facility categories are HOSPITAL, BLOOD_BANK, HEALTH_CENTRE, CLINIC and OTHER, maintained in config/domain.js. referenceNumber is an optional administrative reference, not an invented official Gambian licence. No coordinates exist in Phase 2.

| Action | Allowed transition | Active afterward |
|---|---|---|
| Create | New ? PENDING | true, still untrusted |
| Approve | PENDING ? APPROVED | true |
| Reject | PENDING ? REJECTED | false |
| Suspend | APPROVED ? SUSPENDED | false |
| Reactivate | SUSPENDED ? APPROVED | true |
| Reactivate | REJECTED ? PENDING | true, requires review again |

All status actions require a reason. Repeated/invalid actions return 409. Approval records actor/time; rejection records its reason; embedded status history preserves transitions and reasons. Prior rejection reasons remain historical after reopening. Suspending a facility immediately blocks its future trusted operations; it does not silently rewrite donor verification records previously issued there. Administrators must review affected donor records through the explicit status workflow.

Admins provision new staff accounts only for APPROVED active facilities. Existing donor accounts are never promoted or reassigned. Staff must log in using their provisioned credentials, supplied through an appropriate secure channel by the administrator. No invitation/reset/forced-password-change flow is implemented yet.

A staff account has one facility reference and an explicit facilityPermissions array. Provisioning defaults to VERIFY_DONORS; an empty array is accepted for accounts without verification authority. An active associated user at an approved active facility may see their own facility, but donor lookup, verification and history require VERIFY_DONORS. A role alone never grants facility trust. Public registration cannot choose FACILITY_USER or ADMIN.

## Donor verification lifecycle and traceability

Authorized staff can move UNVERIFIED or REQUIRES_REVERIFICATION to VERIFIED with any of the eight ABO/Rh blood types. Verification records server timestamp, responsible staff/facility, blood type and optional internal notes. It does not perform compatibility calculations.

Admin-only controlled transitions:

- VERIFIED ? SUSPENDED or REQUIRES_REVERIFICATION.
- UNVERIFIED ? SUSPENDED.
- REQUIRES_REVERIFICATION ? SUSPENDED.
- SUSPENDED ? REQUIRES_REVERIFICATION.

Staff cannot bypass suspension or overwrite an already VERIFIED blood type. Admins cannot declare a blood type verified directly. A suspended donor requires an explicit admin transition to REQUIRES_REVERIFICATION, followed by authorized staff verification. Reverification may occur at another approved facility once required. Previous blood type, facility and timestamp remain visible as historical provenance during suspension/reverification; the current status is authoritative.

Every transition creates a separate VerificationEvent with donor, responsible facility where applicable, actor, prior/new statuses, blood type, reason/notes, timestamp and increasing sequence. Admin suspension of an as-yet unverified donor legitimately has no facility/blood type. Notes should contain minimum necessary administrative context, not unnecessary clinical details.

User state and history are written in one MongoDB transaction, with unique (donor, sequence) indexing. Failures roll back both. Staff/account/facility write guards serialize trusted operations with deactivation/suspension, and transaction retries resolve write conflicts. The MVP serializes verification writes per facility, an intentional simplicity/throughput tradeoff. HTTP retries after a successful verification return a status conflict rather than duplicating history.

There are no history update/delete APIs; model query updates/deletes and saves of existing events are rejected. This is application-level append-only history, not protection against privileged direct database administrators or raw collection access.

## API and examples

All paths below begin with /api/v1. Protected endpoints require `Authorization: Bearer <accessToken>`.

| Method | Path | Access |
|---|---|---|
| POST | /auth/register | Public, DONOR only |
| POST | /auth/login | Public |
| GET | /auth/me | Authenticated self |
| GET | /health | Public readiness |
| POST | /admin/facilities | ADMIN |
| GET | /admin/facilities | ADMIN, paginated |
| GET | /admin/facilities/:facilityId | ADMIN |
| PATCH | /admin/facilities/:facilityId/approve | ADMIN |
| PATCH | /admin/facilities/:facilityId/reject | ADMIN |
| PATCH | /admin/facilities/:facilityId/suspend | ADMIN |
| PATCH | /admin/facilities/:facilityId/reactivate | ADMIN |
| POST | /admin/facilities/:facilityId/staff | ADMIN, approved active target |
| GET | /facilities/me | Active associated FACILITY_USER, approved active facility |
| GET | /donors/me/verification | DONOR self |
| GET | /donors/:donorId/verification | Approved authorized staff, exact-ID lookup |
| PATCH | /donors/:donorId/verification | Approved authorized staff |
| GET | /donors/:donorId/verification-history | Approved authorized staff, own facility events |
| PATCH | /admin/donors/:donorId/verification-status | ADMIN |
| GET | /admin/donors/:donorId/verification-history | ADMIN, all donor events |

Registration example (sample password only):

```json
{"name":"Example Donor","email":"donor@example.com","phone":"+220 300 1234","password":"a-long-example-password"}
```

Login requires email/password. Both return `{"success":true,"data":{"user":{},"accessToken":"...","tokenType":"Bearer"}}`. /auth/me returns data.user with account identity/contact fields only. Password hashes never appear.

Facility creation:

```json
{"name":"Example Facility","facilityType":"HEALTH_CENTRE","referenceNumber":"EXAMPLE-REF","phone":"+220 300 1111","email":"facility@example.com","address":"Example address"}
```

Facility approve/reject/suspend/reactivate body: `{"reason":"Administrative review completed"}`.

Staff provisioning: name/email/phone/password as above, optional `"permissions":["VERIFY_DONORS"]`. It returns staff identity, facilityId and permissions without password or access token. It never accepts role/facility/status overrides.

Verification: `{"verifiedBloodType":"O+","notes":"Identity and blood group reviewed"}`. Admin status change: `{"status":"REQUIRES_REVERIFICATION","reason":"Profile requires a fresh review"}`. Donor self-status returns verificationStatus, verifiedBloodType, verifiedAt and a minimal verifying-facility identity. It excludes notes and internal staff IDs.

Facility list query: `?page=1&limit=20&status=PENDING`. History query: `?page=1&limit=20`. Limit is capped at 100; both return pagination {page,limit,total,pages}. History orders newest sequence first. Unknown fields/filter keys, malformed IDs, invalid enums and overlong text are rejected.

Errors use `{"success":false,"error":{"code":"VALIDATION_ERROR","message":"Invalid request body","details":[]}}`. Details are optional and contain field names/messages, never submitted passwords. Common HTTP codes: 400 validation/JSON, 401 unauthenticated/invalid credentials, 403 forbidden/facility access/scope denied, 404 missing record/route, 409 invalid transition/duplicate email/bootstrap conflict, 413 oversized body, 429 rate limit, 500 unexpected failure. Error messages do not expose internal MongoDB details or stacks.

## Privacy and security boundaries

There is no donor directory, contact search, public verification history, third-party coordinate API or generic document dump. Exact location is available only through the authenticated donor self-service API. Authorized staff must know the donor ID; first-time/reverification lookup returns only ID, name, state and their own facility's verified blood type. A donor already verified by another facility cannot be looked up until an admin requires reverification. Cross-facility history reads never include another facility's events. Prior responsible facilities retain access to their own relevant events after a transfer. Admins have explicit shaped endpoints; donors see only their own status without staff IDs or internal notes.

Exact-ID lookup assumes an in-person verification workflow and a securely shared donor ID. A donor-consent/access-grant mechanism is not yet implemented. IDs are not authentication credentials. Future onboarding/privacy review should refine this workflow before a real national pilot.

Phase 1 protections remain: bcrypt cost 12, strict HS256 issuer/audience/expiry verification, fresh active-user checks, Helmet, explicit CORS, JSON size 16 KB, cache prevention, in-memory IP rate limits (200 API requests and 20 combined auth attempts per 15 minutes). Unknown-account login performs an equal-cost hash comparison. Duplicate-email registration intentionally reveals that an email is in use. Rate limits reset on restart and are for one process; CORS is not authorization.

## Existing Phase 1 data

Back up the database before upgrade. Schemas are additive; existing IDs and account roles/passwords are preserved. Donors missing a verification object are treated as UNVERIFIED. Existing roles never imply a verified donor or trusted facility. No production data was migrated during development.

```powershell
npm.cmd run migrate:phase2
```

This idempotent command only backfills missing donorVerification objects for DONOR accounts as {status: UNVERIFIED, revision: 0}. It does not modify already verified records, create synthetic history, promote users or delete data. All other defaults are conservative: no facility association or permissions on existing users. Startup initializes the new indexes; deployments must allow index creation or pre-provision equivalent indexes. Review backup/restore before any rollback; do not delete verification history merely to revert application code.

## Testing and operational limitations

Tests do not load .env or use a configured deployment URI. They create disposable local one-node MongoDB replica sets and verify real transactions/rollback. A local .test-tools/mongod.exe is reused when present; otherwise mongodb-memory-server downloads a binary on first run. Network access may be needed for the first download. The test process uses an extended 60-second mongod launch allowance.

```powershell
npm.cmd test
npm.cmd run check
npm.cmd audit
```

The unchanged Phase 1 scenarios cover registration, hashing, login, token/role restrictions, security headers/rate limits, validation, health, database failure and HTTP startup/shutdown. Phase 2 adds all eight blood groups, facility lifecycle, staff membership/permissions, cross-facility privacy, append-only history, injected history failure rollback, concurrent verification and singleton bootstrap.

No password reset/refresh token/logout revocation, email/phone verification, staff reassignment/password delivery/invitations, extra-admin management, facility document uploads, donor-consent grants or clinical verification protocol is implemented. Administrative references/categories are configurable platform concepts, not official licensing claims. Facility deactivation does not automatically reclassify past donor verifications. A real pilot needs governance of identity evidence, staff credentials, retention/privacy and clinical verification procedure.

## Next phase

Phase 5 should introduce legitimate approved-facility blood requests as the trusted caller of the Phase 4 engine, with ownership checks and request lifecycle/expiry rules. Notifications and donation workflows remain later work. Stop after Phase 4 until approved.

## Phase 2 verification record

Final verification on 30 October 2026 with Node.js 24.12.0 and isolated MongoDB 7.0.24:

- Full suite: 2 test files passed, 130 tests passed, 0 failed; duration 63.04 seconds.
- Phase 1 regression scenarios: 39 retained and passing; Phase 2 scenarios: 91 passing.
- ESLint (`npm.cmd run check`): exit 0, no errors.
- Dependency security audit (`npm.cmd audit --json --cache .npm-cache`): exit 0, 0 vulnerabilities across all reported severities.
- Verified actual transaction rollback on event insertion failure, concurrent donor verification, concurrent facility suspension, concurrent singleton bootstrap, idempotent legacy migration, standalone topology rejection and real HTTP startup/shutdown.

The first complete Phase 2 run passed 128 tests in 70.60 seconds; two upgrade/topology tests were then added and the entire suite rerun. No Phase 2 test failures or lint errors occurred. Injected history-write failures are intentional test cases and their expected HTTP 500 responses roll back database state. CLI secret prompting requires manual use in a real interactive terminal; no production administrator/facility was provisioned, real database migrated or real .env overwritten during implementation. No Phase 3 functionality or frontend changes were made.

## Phase 3: consent-based location and availability

LifeLink does not continuously track donors. It stores only the most recently consented location update supplied by a client. The eventual client obtains device GPS automatically with the donor's permission; donors should not manually type coordinates in the product UI. API examples below are for development/testing.

A stored position does not guarantee the donor is currently there. Freshness reduces this risk but does not eliminate it. Device-provided coordinates are not proof of physical presence. Location readiness is not verified-donor eligibility, medical clearance, willingness for a particular request or a guarantee of response.

### Model and privacy

User has the following additional fields:

```text
availabilityStatus: AVAILABLE | UNAVAILABLE (default UNAVAILABLE)
locationSharingEnabled: boolean (default false)
currentLocation: GeoJSON Point (absent by default; hidden by default projection)
locationUpdatedAt: server-generated Date (absent by default; hidden by default projection)
```

A 2dsphere index is created on currentLocation during User initialization. MongoDB implicitly omits missing locations from this index. Phase 3 itself adds no geospatial lookup; Phase 4 adds the internal query documented below. Coordinates have no fake default. Explicit [0,0] is a valid geographic point and is accepted when deliberately submitted.

Old Phase 1/2 accounts receive conservative read defaults and cannot upload until they explicitly enable sharing. No bulk backfill is necessary. Previously supported verification state/history and facility associations remain untouched. No deployment database or .env is modified automatically.

Exact coordinates and their timestamp are excluded from normal User queries and JSON serialization, providing defense in depth beyond explicit response shaping. Only the donor's authenticated location service explicitly selects them. /auth/me, donor verification, verification history, facility and admin responses never include donor coordinates. There is no admin/facility coordinate access endpoint, nearby donor listing or public map. Self responses use Cache-Control: no-store.

### Consent and availability decisions

- Availability is independent of consent: changing AVAILABLE/UNAVAILABLE never enables or disables sharing and never invents a location.
- UNAVAILABLE with consent and a stored fresh location is allowed, but is not location-ready.
- AVAILABLE without consent or without a fresh location is allowed, but is not location-ready.
- An unverified donor can configure availability, consent and location before visiting a facility. Blood verification remains an independent requirement for future matching.
- Enabling sharing only records consent. It does not create coordinates or change availability.
- Location upload is rejected with HTTP 409 / LOCATION_SHARING_DISABLED unless consent is already enabled.
- Disabling sharing atomically revokes consent and removes both currentLocation and locationUpdatedAt. Availability remains unchanged.
- DELETE location also revokes consent and removes both fields. It is idempotent and preserves availability. A new explicit enable action and a new upload are needed to restore a usable location.
- Admin/facility accounts cannot impersonate donor consent or availability. Existing account deactivation checks remain the separate safety boundary.

Deletion removes data from the live user record and its geospatial index entry. It is not a promise to purge pre-existing database backups, external client copies or infrastructure retention; deployment retention policies require separate governance. No location-history collection or background tracking task is created.

### Freshness and locationReady

DONOR_LOCATION_MAX_AGE_MINUTES defaults to 60 for development. The validated configuration range is 1 to 10080 minutes (one week). It is an operational configuration bound, not a medical or national policy rule; review the production value and any bounds with the platform owners.

isLocationFresh and locationReady are computed at read/use time, never stored booleans. Centralized helpers in src/utils/locationState.js take the configured maximum age and accept an explicit clock for deterministic testing:

```text
fresh = valid location AND valid Date timestamp AND
        0 <= now - locationUpdatedAt <= maxAgeMinutes * 60000

locationReady = active account AND role DONOR AND AVAILABLE AND
                sharing enabled AND fresh valid location
```

Exactly at the threshold is fresh; one millisecond later is stale. Missing/malformed locations, missing/invalid dates and future timestamps fail closed. Application/database clocks should be synchronized. The update timestamp is generated by MongoDB's $currentDate, never accepted from the client. Old locations may remain stored while stale or unavailable until the donor updates or clears them; a fresh timestamp is not sufficient without all other readiness conditions.

The helper deliberately ignores blood verification and compatibility. A location-ready UNVERIFIED donor still cannot be part of the future emergency matching pool. Phase 4 must combine this helper with separate trust and compatibility rules.

### Phase 3 endpoints

All endpoints require an active authenticated DONOR and operate only on that account. No donor identifier is accepted in payloads; arbitrary-donor location/availability routes do not exist.

| Method | Path | Body |
|---|---|---|
| PATCH | /api/v1/donors/me/availability | {"availabilityStatus":"AVAILABLE"} or UNAVAILABLE |
| PATCH | /api/v1/donors/me/location-sharing | {"locationSharingEnabled":true} or false |
| PUT | /api/v1/donors/me/location | GeoJSON Point below |
| GET | /api/v1/donors/me/location | None |
| DELETE | /api/v1/donors/me/location | None or empty object |

Device location upload example:

```json
{"type":"Point","coordinates":[-16.6769,13.4549]}
```

GeoJSON order is **[longitude, latitude]**. Longitude must be -180..180 and latitude -90..90, both finite JSON numbers. Exactly two coordinates and type Point are required. Numeric strings, nulls, booleans, extra dimensions, malformed objects and extra fields are rejected. A swapped pair that still satisfies both numeric ranges cannot be detected from numbers alone; the client must honor GeoJSON order. The backend preserves the supplied order.

All five endpoints return the same explicitly shaped success data:

```json
{
  "success": true,
  "data": {
    "availabilityStatus": "AVAILABLE",
    "locationSharingEnabled": true,
    "hasLocation": true,
    "currentLocation": {"type":"Point","coordinates":[-16.6769,13.4549]},
    "locationUpdatedAt": "2026-10-30T12:00:00.000Z",
    "isLocationFresh": true,
    "locationReady": true
  }
}
```

Absent locations/timestamps return null, with hasLocation/freshness/readiness false. Error formatting and authentication/security limits remain consistent with previous phases. Invalid payloads return 400 VALIDATION_ERROR; unauthenticated/inactive accounts return 401; wrong roles return 403. Direct service calls also require an active DONOR.

A future client can ask for availability, obtain explicit consent, enable sharing, acquire device coordinates and upload them as separate operations. No endpoint silently grants consent when the donor marks themselves available.

### Atomic privacy behavior

All mutations use single-document atomic updates restricted to the authenticated account, DONOR role and active state. Upload includes locationSharingEnabled=true in the write predicate. Consent revocation and deletion each clear coordinates/timestamp in that same atomic update. No read-then-write consent check or full-document replacement is used.

For a concurrent upload and disable/delete, either upload occurs first and is erased, or revocation occurs first and upload returns 409. The final state remains sharing disabled with no coordinates or usable timestamp. Concurrent clearing and availability changes preserve both independent choices. Re-enabling consent is a separate explicit action; the last serialized consent action takes effect. The system does not promise to reject an upload occurring after a genuinely new enable action. Client requests are not GPS attestation or consent-grant version tokens.

Phase 3 adds no multi-document writes, so these operations need no additional transactions; the established replica-set requirement remains for Phase 2 verification/history. Existing field-specific verification writes preserve private location state.

### Phase 3 limitations and next work

No continuous tracking, automatic refresh, automatic stale-data deletion, GPS attestation, historical movement log, admin location override or facility map exists. Progressive radii and compatibility are now implemented internally in Phase 4 below. Blood requests, notifications, donation workflow and frontend remain unimplemented. Retain the existing deployment guidance on TLS, trusted proxies, secrets, account recovery and single-process rate limits.

Tests cover deterministic freshness boundaries and clock changes; strict coordinate/configuration validation; default and independent state combinations; all five endpoint authorization boundaries; mass assignment; location privacy across existing endpoints; real 2dsphere index creation; and concurrent revocation/deletion versus upload. All previous Phase 1/2 tests remain in the full suite.

## Phase 3 verification record

Final verification on 30 October 2026, Node.js 24.12.0, disposable MongoDB 7.0.24 replica sets:

- Entire suite: 4 test files passed, 275 tests passed, 0 failed, duration 66.25 seconds.
- Existing Phase 1/2 regressions: all 130 retained and passing.
- New Phase 3 scenarios: 145 passing, including deterministic state/configuration tests and real database/API/index/concurrency checks.
- Final ESLint: exit 0, no errors.
- Final dependency audit: exit 0, 0 vulnerabilities across all severities.
- Real User 2dsphere index creation and absence of fake default locations verified.
- Repeated concurrent upload versus disable/delete ended revoked with no stored coordinates/timestamp; independent availability changes were preserved.
- Default database projection, JSON serialization and existing auth/verification/facility APIs did not expose exact donor locations.

No test failures, lint errors, dependency vulnerabilities or new unresolved runtime warnings were encountered in this Phase 3 implementation. Earlier-phase intentional error-injection tests continue to exercise safe failures. No dependency changes, real database migration, real .env edits or frontend changes were made. Phase 4 was not started.

## Phase 4: internal compatibility and private geospatial matching

The engine discovers candidate donors for future coordination. It has no HTTP route and is not a donor directory. It is deliberately not imported or exposed by app.js or a controller. Phase 5 must authorize legitimate facility requests before calling it; never pass arbitrary untrusted HTTP search parameters directly to it.

**LifeLink compatibility filtering is for donor coordination and does not replace clinical compatibility testing, crossmatching, donor screening, or professional transfusion decisions.**

This is a simplified ABO/Rh red-cell coordination table, not a whole-blood/plasma rule or proof that blood is safe. Healthcare professionals remain responsible for actual collection and transfusion decisions. The policy needs appropriate clinical/health-authority review before pilot use and can be changed in one centralized compatibility service.

### Centralized compatibility

The existing config/domain.js BLOOD_TYPES remains the sole supported blood-group enum. compatibilityService.js exports getCompatibleDonorBloodTypes(recipientBloodType) and isBloodTypeCompatible({donorBloodType,recipientBloodType}); named parameters make direction explicit. Invalid groups fail with VALIDATION_ERROR, with no fallback matching. Returned arrays cannot mutate the centralized table.

| Recipient/request group | Potential donor red-cell groups |
|---|---|
| O- | O- |
| O+ | O-, O+ |
| A- | O-, A- |
| A+ | O-, O+, A-, A+ |
| B- | O-, B- |
| B+ | O-, O+, B-, B+ |
| AB- | O-, A-, B-, AB- |
| AB+ | O-, O+, A-, A+, B-, B+, AB-, AB+ |

No self-reported group is consulted. The complete 8 by 8 matrix is tested, including incompatible combinations and direction reversal.

### Internal matching interface

```javascript
import { createMatchingService } from './src/services/matchingService.js';

// config is the already validated server configuration, never raw HTTP input.
const matching = createMatchingService(config);
const result = await matching.findCandidates({
  recipientBloodType: 'O+',
  requestLocation: { type: 'Point', coordinates: [-16.6769, 13.4549] },
  radiusKm: 5,
  limit: 20,
});
const expanded = await matching.findCandidatesProgressively({
  recipientBloodType: 'O+',
  requestLocation: { type: 'Point', coordinates: [-16.6769, 13.4549] },
  desiredCandidates: 20,
});
```

This is module usage from the backend root, not a new HTTP API or executable workflow. Both functions accept an optional trusted now Date for deterministic evaluation/tests. Without it the server clock is used. Factory tests may inject {clock: () => new Date(...)} as a second argument. Do not accept evaluation time from external users.

Zod validates every call, including the shared Phase 3 GeoJSON Point schema, finite numeric bounds, blood group, a real valid Date and result limits. Unknown input fields are rejected. radiusKm must be a finite number >0 and <=500; limit and desiredCandidates must be integers 1-100 and default to 20. Stringified numbers are not accepted by the service. These are operational discovery bounds, not notification batch sizes or medical policy.

Single-radius result shape:

```json
{
  "candidates": [
    {"donorId":"0123456789abcdef01234567","verifiedBloodType":"O-","distanceMeters":1082.4}
  ],
  "candidateCount":1,
  "radiusUsedKm":5
}
```

Progressive search returns the same fields plus targetReached and stagesSearched:

```json
{
  "candidates": [],
  "candidateCount":0,
  "radiusUsedKm":40,
  "targetReached":false,
  "stagesSearched":[
    {"radiusKm":5,"candidateCount":0},
    {"radiusKm":10,"candidateCount":0},
    {"radiusKm":20,"candidateCount":0},
    {"radiusKm":40,"candidateCount":0}
  ]
}
```

candidateCount and stage counts count the bounded returned candidates; they are not a census of every eligible donor in the radius. No candidate object includes a name, password/hash, phone, email, exact coordinates, location timestamp, verification notes or facility association. Even internal downstream services must separately authorize any later retrieval of contact data.

### Full candidate eligibility and MongoDB query

Every returned donor must have all of:

- Active account and role DONOR.
- donorVerification.status VERIFIED and a compatible verifiedBloodType.
- availabilityStatus AVAILABLE and explicit locationSharingEnabled=true.
- Valid currentLocation Point with exactly two coordinates and a valid server Date timestamp.
- Location age between zero and the configured maximum age, inclusive.
- Distance within the requested radius according to MongoDB spherical geospatial calculations.

No eligibility boolean or matching result is persisted or cached. Existing verification data is authoritative; suspending an issuing facility does not automatically rewrite those donor records, as documented in Phase 2. Administrative review must explicitly suspend/reclassify affected donor verification when appropriate. Phase 4 adds no new facility-provenance policy beyond the specified donor criteria.

matchingQuery.js builds one shared aggregation pipeline for fixed/progressive queries:

1. $geoNear on key currentLocation, GeoJSON near point, spherical=true and maxDistance=radiusKm*1000. Its query applies active role, verification/compatibility, consent/availability, Point shape and freshness predicates.
2. Strict scalar-type checks exclude malformed legacy/raw arrays and timestamps rather than accidentally accepting an array element.
3. Sort by distanceMeters, then _id for deterministic exact-distance ties.
4. Apply the bounded limit.
5. Project only donorId as a string, verifiedBloodType and distanceMeters within MongoDB before returning records to Node.js.

Distances are meters. Maximum-radius inclusion follows MongoDB's inclusive spherical-distance boundary and floating-point precision. Tests cover measured exact boundary, just-inside/just-outside points and known equatorial distances. GeoJSON order is longitude,latitude; numeric reversal cannot always be detected by validation, but it changes geographic results. Explicit [0,0] is a real location and carries no default-location assumption.

The query uses the existing currentLocation_2dsphere index. The integration suite checks executionStats for GEO_NEAR_2DSPHERE and the actual index name. No additional index was added: the current indexed geographic plan is justified, while speculative compound/support indexes are not. The database performs filtering/distance calculation/sort; Node.js does not load a donor collection to calculate distances. Dense/large deployments should review explain plans and real workload costs, particularly broad radii and deterministic tie sorting.

### Progressive radii and current state

MATCH_RADIUS_STAGES_KM defaults to 5,10,20,40. Configuration accepts comma-separated positive decimal numbers, trims surrounding whitespace, and requires strict ascending order with no duplicates. At most 10 stages are allowed, each <=500 km. Empty tokens, descending/duplicate values, zero/negative values, non-finite values, exponents/hex notation and unsafe bounds fail startup validation. Bounds/defaults are platform settings, not national or medical policy.

Each cumulative stage runs the shared bounded database search, capped at desiredCandidates. Stop when the target is reached or the final configured stage is exhausted. Replace the previous stage's result instead of concatenating it: donors naturally present in multiple cumulative radii appear once, nearest order is preserved, and donors revoked between stages are not retained from an earlier result.

The evaluation clock is captured once per invocation (including all stages) for a coherent freshness cutoff. Every stage still reads current database state. A subsequent invocation gets a new clock value unless a trusted caller explicitly supplies now. No cache hides consent revocation, unavailability, verification suspension, account deactivation or elapsed freshness. Tests revoke consent after the first real database stage and verify that subsequent stages remove that donor.

Candidate discovery is an observation, not a reservation or authorization to contact. State may change during/after a query; future downstream workflows must revalidate eligibility before notification/acceptance or other privileged actions. A fixed evaluation time does not promise freshness forever after results return.

### Phase 4 boundaries and future extension

There is no HTTP /matches, /donors/nearby, /search-donors or equivalent matching route for anonymous users, donors, staff or admins. Matching tests probe those boundaries and rerun existing endpoint privacy checks. Exact donor coordinates remain inside the MongoDB computation, not returned candidate records. Existing donor self-location access remains unchanged.

Confirmed donation state does not exist yet, so no fake donation dates, medical-clearance flag or donation pause were added. A later reviewed operational pause can extend the centralized eligibility predicates once actual facility-confirmed donation records exist. It must not claim medical eligibility.

No blood-request/patient model, request trigger, facility request coordinates, notification provider/record, accept/decline workflow, donation completion/history, units/fulfilment, frontend or maps is implemented. Phase 5 should add legitimate approved-facility blood requests and call this engine through ownership-checked workflows.

Testing combines exhaustive compatibility/configuration tests with real isolated MongoDB geospatial queries: each eligibility exclusion, mixed cases, freshness boundaries, distance units/order/ties, bounded outputs, index explain, progressive early stopping/exhaustion/unique IDs, live state changes, and privacy/no-search-HTTP regression coverage. No production database is contacted and no medical integration is simulated.

## Phase 4 verification record

Final verification on 30 October 2026, Node.js 24.12.0, isolated MongoDB 7.0.24 replica sets:

- Entire suite: 7 test files passed, 495 tests passed, 0 failed; duration 75.14 seconds.
- Phase 1-3 regressions: all 275 retained and passing.
- Phase 4 compatibility: 91 passing tests, including all 64 directed donor/recipient combinations and all eight exact recipient group lists.
- Phase 4 configuration/input validation: 66 passing tests.
- Phase 4 real-database matching: 63 passing tests: 36 eligibility, 9 geospatial/index, 7 progressive-search and 11 live-state/privacy scenarios.
- ESLint: exit 0, no errors.
- Dependency security audit: exit 0, 0 vulnerabilities across all severities.
- Real executionStats confirmed GEO_NEAR_2DSPHERE using currentLocation_2dsphere.
- Exact measured radius boundary, meter distances, deterministic ties, capped outputs, stage stopping/exhaustion and revocation between stages passed.
- Matching candidates have exactly donorId, verifiedBloodType and distanceMeters; no HTTP arbitrary-search route was added.

The first full run had 493 passed and 2 failed: two new privacy tests incorrectly expected 404 for nonexistent admin routes when the existing ADMIN guard correctly returns 403 to donors/staff. The assertions were corrected to test the established 401/403/404 boundaries exactly; no authorization behavior was weakened. The entire suite then passed. No unresolved runtime warnings or errors remain from this phase. No dependencies, indexes, real .env, production data or frontend files were changed; Phase 5 was not started.

## Phase 5: legitimate blood requests

Approved active facility staff need CREATE_BLOOD_REQUESTS to POST /api/v1/requests. Existing/new staff are not automatically granted new permissions; admin provisioning must specify them deliberately. MANAGE_BLOOD_REQUESTS is required for cancellation/internal matching. Other active associated staff can read their facility's requests; active admins can inspect requests. Donors/anonymous callers cannot browse them.

ADMIN sets official facility coordinates through PUT /api/v1/admin/facilities/:facilityId/location with the shared strict GeoJSON Point body. Staff cannot set requestLocation. Each request snapshots that location permanently; later facility moves do not alter it. No patient identity, diagnosis, medical history or national identifier is accepted.

Creation body: patientBloodType (existing blood enum), unitsNeeded (integer 1-100), urgency (CRITICAL/URGENT/PLANNED), expiresAt (future ISO date-time). Urgency is supplied by facility staff for coordination, not clinically determined by LifeLink. BLOOD_REQUEST_MAX_LIFETIME_HOURS defaults to 72 (validated 1-720). unitsReceived begins at zero and cannot be edited through this API.

GET /api/v1/requests supports bounded page/limit, status and urgency. GET /:requestId is owner-facility/admin only. PATCH /:requestId/cancel requires a reason (3-1000 characters), management permission and an active owned request. There is no arbitrary status-update route. OPEN/PARTIALLY_FILLED are active only before expiresAt. Read models derive EXPIRED immediately; internal expireRequests can persist it afterward, but no cron is required for correctness. Terminal requests cannot be cancelled or matched. Internal matchBloodRequest uses stored blood type/location and returns minimized Phase 4 candidates to trusted code; there is no matching HTTP endpoint. Fulfilment remains reserved for confirmed donations in Phase 7.

## Phase 6: in-app notifications and donor responses

POST /api/v1/requests/:requestId/broadcast requires owning-facility MANAGE_BLOOD_REQUESTS and {idempotencyKey: UUID, expand: false, desiredCandidates: 20}. Initially only the first configured radius is permitted. An explicit expand=true allows the next stage; progressive matching still stops at the smallest sufficient radius. The private engine can internally exclude already-notified IDs (bounded to 1000); this is not an HTTP search option. Each request has a 1000-recipient operational cap, each operation a 100-candidate cap, and one IN_APP notification per request/donor. Reusing an idempotency key returns its original result. Concurrent radius changes can return BROADCAST_STATE_CHANGED; reload rather than blindly expanding again.

GeoNear runs before the transaction because MongoDB does not support that operator in multi-document transactions. A transaction then locks the owned active request, current staff/facility and each preselected donor and rechecks consent, verification, availability, freshness and distance on at most 100 candidates. This bounded recheck is not a replacement full-collection matching algorithm. Notification records and broadcast state commit together. Cancelled, expired or fulfilled requests cannot broadcast. There is no matching-candidate HTTP view.

GET /api/v1/notifications returns only the active donor's own paginated records (optional unread=true/false). PATCH /:notificationId/read is idempotent. POST /:notificationId/response accepts ACCEPTED or DECLINED. Only the intended donor may respond. A response is final: identical retries return the original response, but changing it returns RESPONSE_FINAL. For this MVP donors must contact the facility if their situation changes after accepting; a future withdrawal workflow needs explicit design. Closed requests reject responses. ACCEPTED rechecks all current candidate requirements and may include a fresh GeoJSON location without silently enabling consent. DECLINED needs no location upload. Acceptance never creates a donation or changes received units.

GET /api/v1/requests/:requestId/responses requires owning-facility management permission. Accepted responses on active requests may reveal name/phone/verified blood type for coordination; declined/closed responses do not reveal donor contact. Email and exact donor GPS are never returned. In-app DELIVERED means a real record is available in the donor inbox, not that a device displayed/read it. READ is explicit. The provider interface implements only IN_APP; SMS/WhatsApp/push/email throw CHANNEL_NOT_CONFIGURED and are not claimed as delivered. No external provider or messages were used.

## Phase 7: confirmed donations, fulfilment and matching pause

POST /api/v1/requests/:requestId/donations requires owning-facility CONFIRM_DONATIONS and {donorId, units}. The donor must have an ACCEPTED response and currently valid active verified profile. Only an active unexpired request can receive a new confirmation. GPS consent/availability are not medical conditions and are not required to record an actual accepted donation. Identical repeated confirmations are idempotent, including after fulfilment; changing units on an already-confirmed event is rejected.

One immutable Donation per request/donor records facility, accepted response, confirming staff, server confirmation time, units and verified blood-type snapshot. units is an integer 1-4 and cannot exceed the request's remaining requirement. This is a bounded coordination-record convention, not a prescription of safe collection volume; multi-unit/product policy requires clinical review. If a correction is needed, an explicit future auditable correction workflow is required rather than editing/deleting history.

Donation creation, unitsReceived increment, PARTIALLY_FILLED/FULFILLED transition, fulfilledAt and lastConfirmedDonationAt update are one transaction. Request locks serialize competing confirmations and prevent overfill. Availability is preserved. lastConfirmedDonationAt is a private transactional denormalization of the latest confirmed event. The unique request/donor index prevents double counting. Failed writes roll back all of these changes.

GET /api/v1/donors/me/donations is donor self-history. GET /requests/:requestId/donations is owning-facility confirmation staff history; GET /admin/donations is admin-only with bounded facilityId/donorId filters. Responses contain minimal confirmed-record data, no donor phone/email/GPS. A fulfilled request stops new notifications/responses and stops revealing accepted contact in response lists.

DONATION_MATCHING_PAUSE_DAYS defaults to 56 development days, validated 1-365. It is a configurable PLATFORM MATCHING PAUSE, not medical clearance or a universal medical interval. Production policy must be determined with relevant health authorities. Matching and new acceptance exclude a recently confirmed donor; the exact boundary is eligible again for platform matching, subject to all other requirements. Missing prior donation means no pause; invalid/future last-donation state fails closed. No cron reactivation or persisted medical-eligibility boolean exists. An already accepted actual donation can still be recorded by staff without using this timer as a clinical rule.

## Phase 8: administration and audit

AuditLog is application-level append-only, with actor/role, action, target, optional facility context, timestamp and strictly allowlisted metadata. It is written inside the domain transaction; audit insertion failure aborts the sensitive mutation. Logged actions include facility lifecycle/location, staff provisioning/permissions, donor verification/status, request creation/cancellation, broadcasts, donor responses, confirmed donations, initial-admin bootstrap and account status changes. Historical pre-Phase-8 actions are not fabricated/backfilled. Direct database administrators remain privileged; append-only application guards are not cryptographic tamper evidence.

Only ADMIN may GET /api/v1/admin/audit-logs with bounded page/limit and actor/action/targetId/facilityId filters. No normal audit update/delete endpoints exist. Metadata allows structured statuses, permissions, unit/count/radius values and account reason codes, not free text, notes, passwords, tokens, full bodies, phone/email or exact donor coordinates.

PATCH /admin/accounts/:userId/status accepts {isActive, reasonCode}, where reasonCode is ACCOUNT_REVIEW, SECURITY_REVIEW or USER_REQUEST. Admin self-deactivation is forbidden; the last active admin is protected. There is no password-view/reset API or account deletion. PUT /admin/facilities/:facilityId/staff/:userId/permissions accepts an explicit unique permission list and only targets an existing associated FACILITY_USER; it cannot promote donors or move staff between facilities. Permissions are VERIFY_DONORS, CREATE_BLOOD_REQUESTS, MANAGE_BLOOD_REQUESTS, CONFIRM_DONATIONS. Existing default provisioning remains VERIFY_DONORS only.

GET /admin/stats returns seven numeric counts: donors, verifiedDonors, availableDonors, approvedFacilities, openRequests, fulfilledRequests and confirmedDonations. Available is not equivalent to match eligible; open-request counts exclude expired records even before cleanup. No per-person analytics or coordinate map is returned.
