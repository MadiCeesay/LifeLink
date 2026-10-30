# Supported API operations

All normal JSON responses use the documented success/error envelope; the OpenAPI JSON endpoint returns the specification itself. Bearer authentication and fresh active-account checks apply except registration, login, health and documentation. Staff also need approved active facility association and the specified permission/owner scope.

| Method | Path | Roles | Explicit permission | Purpose |
|---|---|---|---|---|
| POST | /api/v1/auth/register | PUBLIC | See ownership/role rules | Register an unverified donor account |
| POST | /api/v1/auth/login | PUBLIC | See ownership/role rules | Authenticate an active account |
| GET | /api/v1/auth/me | DONOR, FACILITY_USER, ADMIN | See ownership/role rules | Read your account identity |
| GET | /api/v1/health | PUBLIC | See ownership/role rules | Database readiness (503 when unavailable) |
| GET | /api/v1/admin/facilities | ADMIN | See ownership/role rules | List facilities |
| POST | /api/v1/admin/facilities | ADMIN | See ownership/role rules | Create a pending facility |
| GET | /api/v1/admin/facilities/{facilityId} | ADMIN | See ownership/role rules | Read an administrative facility view |
| PATCH | /api/v1/admin/facilities/{facilityId}/approve | ADMIN | See ownership/role rules | approve a facility through its legal lifecycle |
| PATCH | /api/v1/admin/facilities/{facilityId}/reject | ADMIN | See ownership/role rules | reject a facility through its legal lifecycle |
| PATCH | /api/v1/admin/facilities/{facilityId}/suspend | ADMIN | See ownership/role rules | suspend a facility through its legal lifecycle |
| PATCH | /api/v1/admin/facilities/{facilityId}/reactivate | ADMIN | See ownership/role rules | reactivate a facility through its legal lifecycle |
| PUT | /api/v1/admin/facilities/{facilityId}/location | ADMIN | See ownership/role rules | Set official facility location (not donor location) |
| POST | /api/v1/admin/facilities/{facilityId}/staff | ADMIN | See ownership/role rules | Provision staff at an approved active facility |
| PUT | /api/v1/admin/facilities/{facilityId}/staff/{userId}/permissions | ADMIN | See ownership/role rules | Set an associated staff permission list |
| PATCH | /api/v1/admin/accounts/{userId}/status | ADMIN | See ownership/role rules | Deactivate/reactivate an account and invalidate old sessions |
| GET | /api/v1/admin/stats | ADMIN | See ownership/role rules | Read aggregate operational counts |
| GET | /api/v1/admin/audit-logs | ADMIN | See ownership/role rules | Read safe append-oriented audit events |
| GET | /api/v1/admin/donations | ADMIN | See ownership/role rules | Read minimal confirmed donation records |
| PATCH | /api/v1/admin/donors/{donorId}/verification-status | ADMIN | See ownership/role rules | Suspend verification or require reverification |
| GET | /api/v1/admin/donors/{donorId}/verification-history | ADMIN | See ownership/role rules | Read donor verification history |
| GET | /api/v1/facilities/me | FACILITY_USER | See ownership/role rules | Read your approved active associated facility |
| GET | /api/v1/donors/me/verification | DONOR | See ownership/role rules | Read your verification state (not medical clearance) |
| GET | /api/v1/donors/{donorId}/verification | FACILITY_USER | VERIFY_DONORS | Exact-ID minimal lookup within verification scope |
| PATCH | /api/v1/donors/{donorId}/verification | FACILITY_USER | VERIFY_DONORS | Record professional profile/blood-group verification |
| GET | /api/v1/donors/{donorId}/verification-history | FACILITY_USER | VERIFY_DONORS | Read only your facility verification events |
| GET | /api/v1/donors/me/location | DONOR | See ownership/role rules | Read only your own exact location and privacy state |
| PUT | /api/v1/donors/me/location | DONOR | See ownership/role rules | Upload device location with existing consent |
| DELETE | /api/v1/donors/me/location | DONOR | See ownership/role rules | Erase coordinates/timestamp and revoke consent |
| PATCH | /api/v1/donors/me/availability | DONOR | See ownership/role rules | Set independent availability |
| PATCH | /api/v1/donors/me/location-sharing | DONOR | See ownership/role rules | Set explicit consent; disabling erases location |
| GET | /api/v1/donors/me/donations | DONOR | See ownership/role rules | Read your confirmed donation history |
| GET | /api/v1/requests | FACILITY_USER, ADMIN | See ownership/role rules | List your facility requests (admins may inspect all) |
| POST | /api/v1/requests | FACILITY_USER | CREATE_BLOOD_REQUESTS | Create a request from stored facility location |
| GET | /api/v1/requests/{requestId} | FACILITY_USER, ADMIN | See ownership/role rules | Read an owned request (or admin view) |
| PATCH | /api/v1/requests/{requestId}/cancel | FACILITY_USER | MANAGE_BLOOD_REQUESTS | Cancel an active owned request |
| POST | /api/v1/requests/{requestId}/broadcast | FACILITY_USER | MANAGE_BLOOD_REQUESTS | Create bounded deduplicated in-app notifications |
| GET | /api/v1/requests/{requestId}/responses | FACILITY_USER | MANAGE_BLOOD_REQUESTS | Read own request responses with minimal accepted contact |
| GET | /api/v1/requests/{requestId}/donations | FACILITY_USER | CONFIRM_DONATIONS | Read confirmed donations for own facility request |
| POST | /api/v1/requests/{requestId}/donations | FACILITY_USER | CONFIRM_DONATIONS | Confirm an actual accepted donation transactionally |
| GET | /api/v1/notifications | DONOR | See ownership/role rules | Read only your own in-app notifications |
| PATCH | /api/v1/notifications/{notificationId}/read | DONOR | See ownership/role rules | Mark own notification read idempotently |
| POST | /api/v1/notifications/{notificationId}/response | DONOR | See ownership/role rules | Accept or decline your notification |
| GET | /api/v1/docs/openapi.json | PUBLIC | See ownership/role rules | Read this OpenAPI specification |
