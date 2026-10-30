# LifeLink mobile

React Native / Expo / TypeScript client for the existing LifeLink backend. Donor, facility and admin experiences share one design system. No frontend sample records or mock API are used.

## Setup

Use a Node version supported by the installed Expo SDK (the generated project currently targets SDK 58), npm and Expo Go compatible with that SDK, or an EAS development build. Android Studio is not required for physical-device testing.

From C:\Users\Admin\Desktop\LifeLink\frontend:

```powershell
npm install
Copy-Item .env.example .env
# Edit .env: EXPO_PUBLIC_API_URL=https://YOUR-API-HOST/api/v1
npm start
```

Scan the Expo QR code with a compatible Expo Go app on Android. For a development build, first run `npx expo install expo-dev-client`, then run `npx eas-cli build --profile development --platform android`, install that build, then `npx expo start --dev-client`. EAS requires your own Expo account and project setup; no build was submitted by this implementation.

## API networking

Use EXPO_PUBLIC_API_URL with the /api/v1 suffix, no trailing slash. Restart Expo after changing it. It is public configuration, never a place for credentials. The application has no permanent fallback URL.

A physical phone's localhost is the phone itself. The completed backend currently binds only to 127.0.0.1 on the PC. Use your own HTTPS tunnel to the PC's backend port, or a reachable staging deployment. Merely using the PC's LAN IP will not work with the existing loopback bind. This client does not change backend host, firewall, TLS or CORS rules. An Expo Metro tunnel exposes the bundle, not the API; these are separate connections. For browser testing on the same PC, use http://127.0.0.1:5000/api/v1 and an origin already allowed by backend CORS (for example choose Expo web port 3000 if localhost:3000 is configured). Check /api/v1/health before troubleshooting the client.

Backend startup (separate terminal):

```powershell
cd C:\Users\Admin\Desktop\LifeLink\backend
npm run dev
```

The backend needs its existing replica set and root backend/.env; frontend/.env and backend/tests/.env are unrelated.

## Structure

```text
src/app/                   Expo Router screens and protected stacks
  (auth)/                  welcome, login, donor registration
  (donor)/                 Home, Requests, History, Profile tabs
  (facility)/              Home, Requests, Verify, More tabs
  (admin)/                 Overview, Facilities, Activity, More tabs
  donor/                   notification inbox/detail
  facility/                create request, coordination details
  admin/                   facility, staff, accounts, oversight, donations
src/
  components/              shared accessible UI, tabs, lists, request cards
  constants/contracts.json backend OpenAPI schema snapshot
  features/                auth, donor, facility, admin, donations, form modules
  hooks/                   query and mutation hooks
  providers/               authentication and query clients
  services/                centralized HTTP, SecureStore, device location
  theme/                   colors, spacing, type and radius tokens
  types/api.ts             generated backend contract types
  utils/                   display/status/routing helpers
tests/                     critical behavioral tests
docs/                      implementation and manual verification reports
```

## State, authentication and privacy

TanStack Query manages API reads and invalidation. Axios uses a 15-second timeout, bearer attachment and safe errors. React Hook Form and Zod validate identity and operation forms; the backend remains authoritative. Authentication is restored using /auth/me; role routes are protected by fresh identity. Only donors publicly register. Native bearer credentials use Expo SecureStore with device-only unlocked accessibility. Web preview keeps tokens in memory, so browser refresh signs out. There is no refresh-token endpoint; expired sessions require sign-in. Logout cancels queries and clears query cache and secure storage. The frontend never independently grants a role or fabricates a successful mutation.

In-app notifications refresh while their screen is mounted, with pull/manual refresh elsewhere. No background push, SMS, email or WhatsApp delivery is claimed. No public donor directory, arbitrary donor search or donor map exists. Donors see only their own notification-scoped requests. Their exact coordinates are not rendered and are stripped from the shared own-location query cache. No credentials, device coordinates or API response bodies are logged.

## Location

Sharing is explicit: explanation and confirmation, foreground OS permission, one device fix, backend consent update, upload in [longitude, latitude] order. OS denial, disabled services and timeouts show errors. No manual coordinate entry and no fallback coordinates. Updates and acceptance use existing consent; acceptance never enables it. Turning sharing off erases the location through the existing backend contract. No background tracking is requested. Setting the official facility origin is separate: an admin must confirm they are physically at the facility before uploading the current device position.

## Permissions and API limitations

The backend's /auth/me returns role but no staff permissions, and /facilities/me returns facility identity only. No endpoint reads the current staff permission set or lists staff. Accordingly restricted actions state their required permission and rely on backend checks; they are not presented as pre-authorized. The frontend handles 403 and never derives permissions from role alone. A future authenticated capability endpoint would enable exact proactive hiding of unavailable staff actions; none was added here.

Admin staff changes use exact known IDs. Permission replacement requires explicit confirmation of the full new set; there is no read-modify-write guess. Facility details do not expose saved official location; the client acknowledges updates but does not pretend to retrieve coordinates. Request history returns facility IDs rather than populated facility names. Donor notification detail uses paginated inbox traversal because there is no get-one notification endpoint; it does not call a facility-only request endpoint. Donor matching pause is not exposed in donor state and is not invented by the client.

## Checks and builds

```powershell
npm run typecheck
npm run lint
npm test
npm run export:android
npm run contracts
# Optional browser smoke test:
npx expo start --web --port 3000
# Optional private preview APK, after your EAS setup:
npx eas-cli build --profile preview --platform android
```

contracts refreshes TypeScript types and the form schema snapshot from the adjacent backend spec. If that spec changes, review and recheck affected forms. There are no backend schema changes in this implementation.

## Manual acceptance

Use separate real donor/staff/admin accounts created through the existing backend workflows. Never publish their credentials. See docs/MANUAL_TESTS.md for device and end-to-end acceptance. Build/export checks do not prove native OS permissions or a real clinical workflow; device acceptance is a separate check. This is coordination software, not clinical clearance or a transfusion decision system.

Implementation report and exact check results: [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md).

Verified here: strict types and lint (zero warnings), 38 tests including the isolated real-API workflow, Android/iOS/web exports, and Expo HTTP startup. Native device and visual acceptance remain pending. The current dependency audit has 3 high and 5 low findings in Expo tooling; see the report before release.
