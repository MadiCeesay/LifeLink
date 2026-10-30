import { writeFileSync } from 'node:fs';
import { BLOOD_TYPES, FACILITY_TYPES, FACILITY_STATUSES, VERIFICATION_STATUSES, STAFF_PERMISSIONS, AVAILABILITY_STATUSES, URGENCIES, REQUEST_STATUSES, NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES, DONOR_RESPONSE_STATUSES, AUDIT_ACTIONS } from '../src/config/domain.js';
import { ROLES } from '../src/models/User.js';
const str = extra => ({ type: 'string', ...extra });
const integer = (minimum = 0, maximum) => ({ type: 'integer', minimum, ...(maximum ? { maximum } : {}) });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false });
const array = items => ({ type: 'array', items });
const ref = name => ({ $ref: '#/components/schemas/' + name });
const id = str({ pattern: '^[a-fA-F0-9]{24}$', example: '0123456789abcdef01234567' });
const date = str({ format: 'date-time' });
const bool = { type: 'boolean' };
const blood = str({ enum: [...BLOOD_TYPES] });
const roles = Object.values(ROLES);
const permissions = { ...array(str({ enum: [...STAFF_PERMISSIONS] })), uniqueItems: true, maxItems: STAFF_PERMISSIONS.length };
const name = str({ minLength: 2, maxLength: 100 });
const email = str({ format: 'email', maxLength: 254, example: 'example@example.invalid' });
const phone = str({ minLength: 7, maxLength: 30, pattern: '^\\+?[0-9 ()-]+$', description: '7-15 digits; common international formatting accepted, including Gambian numbers.' });
const password = str({ minLength: 12, maxLength: 72, format: 'password', writeOnly: true, description: 'At most 72 UTF-8 bytes, not merely characters. Never returned.' });
const schemas = {
  Error: obj({ success: { type: 'boolean', enum: [false] }, error: obj({ code: str(), message: str(), details: array(obj({ field: str(), message: str() })) }, ['code', 'message']) }),
  GeoPoint: obj({ type: str({ enum: ['Point'] }), coordinates: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: -180, maximum: 180 }, description: 'Exactly [longitude, latitude]: longitude -180..180; latitude -90..90. Both finite JSON numbers. Backend enforces position-specific bounds.', example: [-16.6, 13.4] } }),
  Registration: obj({ name, email, phone, password, role: str({ enum: ['DONOR'] }) }, ['name', 'email', 'phone', 'password']),
  Login: obj({ email, password: str({ minLength: 1, maxLength: 72, format: 'password', writeOnly: true }) }),
  User: obj({ id, name: str(), email, phone, role: str({ enum: roles }), isActive: bool, createdAt: date, updatedAt: date }),
  Session: obj({ user: ref('User'), accessToken: str({ description: 'Short-lived signed bearer token; no real token example is published.' }), tokenType: str({ enum: ['Bearer'] }) }),
  FacilityCreate: obj({ name, facilityType: str({ enum: [...FACILITY_TYPES] }), referenceNumber: str({ minLength: 1, maxLength: 100 }), phone, email, address: str({ minLength: 3, maxLength: 500 }) }, ['name', 'facilityType', 'phone', 'email', 'address']),
  FacilityTransition: obj({ previousStatus: str({ enum: [...FACILITY_STATUSES] }), newStatus: str({ enum: [...FACILITY_STATUSES] }), performedBy: id, reason: str(), timestamp: date }),
  Facility: obj({ id, name: str(), facilityType: str({ enum: [...FACILITY_TYPES] }), phone, email, address: str(), verificationStatus: str({ enum: [...FACILITY_STATUSES] }), isActive: bool, referenceNumber: str(), approvedAt: date, approvedBy: id, rejectionReason: str(), createdBy: id, createdAt: date, updatedAt: date, statusHistory: array(ref('FacilityTransition')) }, ['id', 'name', 'facilityType', 'phone', 'email', 'address', 'verificationStatus', 'isActive']),
  FacilityLocation: obj({ facilityId: id, location: ref('GeoPoint'), locationUpdatedAt: date }),
  StaffCreate: obj({ name, email, phone, password, permissions }, ['name', 'email', 'phone', 'password']),
  Staff: obj({ id, name: str(), email, phone, role: str({ enum: ['FACILITY_USER'] }), facilityId: id, permissions, isActive: bool, createdAt: date }),
  Reason: obj({ reason: str({ minLength: 3, maxLength: 1000 }) }),
  VerificationInput: obj({ verifiedBloodType: blood, notes: str({ minLength: 1, maxLength: 1000, description: 'Minimum administrative context only, not a clinical record.' }) }, ['verifiedBloodType']),
  VerificationStatusInput: obj({ status: str({ enum: ['SUSPENDED', 'REQUIRES_REVERIFICATION'] }), reason: str({ minLength: 3, maxLength: 1000 }) }),
  Verification: obj({ verificationStatus: str({ enum: [...VERIFICATION_STATUSES] }), verifiedBloodType: str({ enum: [...BLOOD_TYPES, null], nullable: true }), verifiedAt: { ...date, nullable: true }, verifiedByFacility: { ...obj({ id, name: str(), facilityType: str({ enum: [...FACILITY_TYPES] }) }), nullable: true } }),
  DonorLookup: obj({ id, name: str(), verificationStatus: str({ enum: [...VERIFICATION_STATUSES] }), verifiedBloodType: str({ enum: [...BLOOD_TYPES, null], nullable: true }) }),
  VerificationEvent: obj({ id, donorId: id, facilityId: { ...id, nullable: true }, performedBy: id, previousStatus: str({ enum: [...VERIFICATION_STATUSES] }), newStatus: str({ enum: [...VERIFICATION_STATUSES] }), verifiedBloodType: str({ enum: [...BLOOD_TYPES, null], nullable: true }), reason: str(), notes: str({ description: 'Only authorized verification-history readers receive internal notes.' }), sequence: integer(1), timestamp: date }, ['id', 'donorId', 'facilityId', 'performedBy', 'previousStatus', 'newStatus', 'verifiedBloodType', 'sequence', 'timestamp']),
  AvailabilityInput: obj({ availabilityStatus: str({ enum: [...AVAILABILITY_STATUSES] }) }),
  ConsentInput: obj({ locationSharingEnabled: bool }),
  LocationState: obj({ availabilityStatus: str({ enum: [...AVAILABILITY_STATUSES] }), locationSharingEnabled: bool, hasLocation: bool, currentLocation: { ...obj({ type: str({ enum: ['Point'] }), coordinates: { ...array({ type: 'number' }), minItems: 2, maxItems: 2 } }), nullable: true }, locationUpdatedAt: { ...date, nullable: true }, isLocationFresh: bool, locationReady: bool }),
  RequestCreate: obj({ patientBloodType: blood, unitsNeeded: integer(1, 100), urgency: str({ enum: [...URGENCIES] }), expiresAt: { ...date, description: 'Future expiry, within BLOOD_REQUEST_MAX_LIFETIME_HOURS. No patient identity or staff-supplied coordinates.' } }),
  BloodRequest: obj({ id, requestingFacility: id, createdBy: id, patientBloodType: blood, unitsNeeded: integer(1, 100), unitsReceived: integer(0, 100), remainingUnits: integer(0, 100), urgency: str({ enum: [...URGENCIES] }), status: str({ enum: [...REQUEST_STATUSES] }), requestLocation: ref('GeoPoint'), expiresAt: date, fulfilledAt: date, cancelledAt: date, cancellationReason: str(), createdAt: date, updatedAt: date }, ['id', 'requestingFacility', 'createdBy', 'patientBloodType', 'unitsNeeded', 'unitsReceived', 'remainingUnits', 'urgency', 'status', 'requestLocation', 'expiresAt', 'createdAt', 'updatedAt']),
  BroadcastInput: obj({ idempotencyKey: str({ format: 'uuid' }), expand: { ...bool, default: false }, desiredCandidates: { ...integer(1, 100), default: 20 } }, ['idempotencyKey']),
  Broadcast: obj({ id, bloodRequest: id, radiusUsedKm: { type: 'number' }, candidateCount: integer(0, 100), notifiedCount: integer(0, 100), createdAt: date }),
  Notification: obj({ id, responseStatus: str({ enum: ['PENDING', ...DONOR_RESPONSE_STATUSES], description: 'Derived own response state, not a separate PENDING response record.' }), channel: str({ enum: [...NOTIFICATION_CHANNELS] }), status: str({ enum: [...NOTIFICATION_STATUSES] }), sentAt: date, readAt: { ...date, nullable: true }, bloodRequest: { ...obj({ id, patientBloodType: blood, unitsNeeded: integer(1, 100), remainingUnits: integer(0, 100), urgency: str({ enum: [...URGENCIES] }), status: str({ enum: [...REQUEST_STATUSES] }), expiresAt: date, facility: { ...obj({ id, name: str(), address: str() }), nullable: true }, actionable: bool }), nullable: true } }),
  ResponseInput: obj({ status: str({ enum: [...DONOR_RESPONSE_STATUSES] }), location: { ...ref('GeoPoint'), description: 'Optional fresh device location only on acceptance; existing consent required.' } }, ['status']),
  DonorResponse: obj({ id, bloodRequest: id, status: str({ enum: [...DONOR_RESPONSE_STATUSES] }), respondedAt: date }),
  FacilityResponse: obj({ id, bloodRequest: id, status: str({ enum: [...DONOR_RESPONSE_STATUSES] }), respondedAt: date, donor: { ...obj({ id, name: str(), phone, verifiedBloodType: blood }), nullable: true, description: 'Contact only for accepted, active, currently verified compatible donors on active owned requests; otherwise null.' } }),
  DonationInput: obj({ donorId: id, units: integer(1, 4) }),
  Donation: obj({ id, donorId: id, bloodRequest: id, facilityId: id, confirmedAt: date, units: integer(1, 4), bloodTypeSnapshot: blood }),
  AccountStatusInput: obj({ isActive: bool, reasonCode: str({ enum: ['ACCOUNT_REVIEW', 'SECURITY_REVIEW', 'USER_REQUEST'] }) }),
  AccountStatus: obj({ id, role: str({ enum: roles }), isActive: bool }),
  PermissionsInput: obj({ permissions }),
  StaffPermissions: obj({ id, facilityId: id, permissions }),
  AuditMetadata: obj({ previousStatus: str(), newStatus: str(), units: integer(1, 4), radiusKm: { type: 'number', exclusiveMinimum: true, minimum: 0, maximum: 500 }, notificationCount: integer(0, 100), isActive: bool, permissions, reasonCode: str({ enum: ['ACCOUNT_REVIEW', 'SECURITY_REVIEW', 'USER_REQUEST'] }) }, []),
  AuditLog: obj({ id, actor: id, actorRole: str({ enum: roles }), action: str({ enum: [...AUDIT_ACTIONS] }), targetType: str({ enum: ['Facility', 'User', 'BloodRequest', 'Donation', 'DonorResponse'] }), targetId: id, facilityId: id, timestamp: date, metadata: ref('AuditMetadata') }, ['id', 'actor', 'actorRole', 'action', 'targetType', 'targetId', 'timestamp', 'metadata']),
  Stats: obj(Object.fromEntries(['donors', 'verifiedDonors', 'availableDonors', 'approvedFacilities', 'openRequests', 'fulfilledRequests', 'confirmedDonations'].map(k => [k, integer()]))),
  Pagination: obj({ page: integer(1, 100000), limit: integer(1, 100), total: integer(), pages: integer() }),
  Empty: obj({}),
};
const success = schema => obj({ success: { type: 'boolean', enum: [true] }, data: schema });
const paged = (key, schema) => obj({ [key]: array(ref(schema)), pagination: ref('Pagination') });
const query = (name, schema) => ({ name, in: 'query', required: false, schema });
const page = [query('page', { ...integer(1, 100000), default: 1 }), query('limit', { ...integer(1, 100), default: 20 })];
const facilityQuery = [...page, query('status', str({ enum: [...FACILITY_STATUSES] }))];
const requestQuery = [...page, query('status', str({ enum: [...REQUEST_STATUSES] })), query('urgency', str({ enum: [...URGENCIES] }))];
const donationQuery = [...page, query('facilityId', id), query('donorId', id)];
const paths = {};
function add(method, path, summary, roleList, body, output, { code = 200, queries = [], permission, description = '', publicRoute = false, raw = false } = {}) {
  const parameters = [...[...path.matchAll(/\{(\w+)\}/g)].map(([, key]) => ({ name: key, in: 'path', required: true, schema: id })), ...queries];
  const operation = { operationId: method + path.replace(/[^a-zA-Z0-9]+/g, '_'), summary, description, tags: [path.split('/')[1]], security: publicRoute ? [] : [{ bearerAuth: [] }], 'x-roles': roleList, ...(permission ? { 'x-permissions': [permission] } : {}), parameters,
    responses: { [code]: { description: 'Success', content: { 'application/json': { schema: raw ? output : success(output) } } } } };
  if (body) operation.requestBody = { required: body !== 'Empty', content: { 'application/json': { schema: ref(body) } } };
  const errors = publicRoute ? [400, 401, 409, 413, 429, 500, 503] : [400, 401, 403, 404, 409, 413, 429, 500, 503];
  for (const status of errors) operation.responses[status] = { description: 'Stable error envelope. No raw database errors or stacks.', content: { 'application/json': { schema: ref('Error') } } };
  paths[path] ??= {}; paths[path][method] = operation;
}
add('post', '/auth/register', 'Register an unverified donor account', ['PUBLIC'], 'Registration', ref('Session'), { code: 201, publicRoute: true });
add('post', '/auth/login', 'Authenticate an active account', ['PUBLIC'], 'Login', ref('Session'), { publicRoute: true });
add('get', '/auth/me', 'Read your account identity', roles, null, obj({ user: ref('User') }));
add('get', '/health', 'Database readiness (503 when unavailable)', ['PUBLIC'], null, obj({ status: str({ enum: ['ok'] }) }), { publicRoute: true });
add('post', '/admin/facilities', 'Create a pending facility', ['ADMIN'], 'FacilityCreate', ref('Facility'), { code: 201 });
add('get', '/admin/facilities', 'List facilities', ['ADMIN'], null, paged('facilities', 'Facility'), { queries: facilityQuery });
add('get', '/admin/facilities/{facilityId}', 'Read an administrative facility view', ['ADMIN'], null, ref('Facility'));
for (const action of ['approve', 'reject', 'suspend', 'reactivate']) add('patch', '/admin/facilities/{facilityId}/' + action, action + ' a facility through its legal lifecycle', ['ADMIN'], 'Reason', ref('Facility'));
add('put', '/admin/facilities/{facilityId}/location', 'Set official facility location (not donor location)', ['ADMIN'], 'GeoPoint', ref('FacilityLocation'));
add('post', '/admin/facilities/{facilityId}/staff', 'Provision staff at an approved active facility', ['ADMIN'], 'StaffCreate', ref('Staff'), { code: 201, description: 'Only VERIFY_DONORS is granted by default. Other permissions must be explicit. No token or password is returned.' });
add('put', '/admin/facilities/{facilityId}/staff/{userId}/permissions', 'Set an associated staff permission list', ['ADMIN'], 'PermissionsInput', ref('StaffPermissions'));
add('patch', '/admin/accounts/{userId}/status', 'Deactivate/reactivate an account and invalidate old sessions', ['ADMIN'], 'AccountStatusInput', ref('AccountStatus'), { description: 'No admin self-deactivation or last-admin lockout.' });
add('get', '/admin/stats', 'Read aggregate operational counts', ['ADMIN'], null, ref('Stats'));
add('get', '/admin/audit-logs', 'Read safe append-oriented audit events', ['ADMIN'], null, paged('auditLogs', 'AuditLog'), { queries: [...page, query('actor', id), query('action', str({ enum: [...AUDIT_ACTIONS] })), query('targetId', id), query('facilityId', id)] });
add('get', '/admin/donations', 'Read minimal confirmed donation records', ['ADMIN'], null, paged('donations', 'Donation'), { queries: donationQuery });
add('patch', '/admin/donors/{donorId}/verification-status', 'Suspend verification or require reverification', ['ADMIN'], 'VerificationStatusInput', ref('Verification'));
add('get', '/admin/donors/{donorId}/verification-history', 'Read donor verification history', ['ADMIN'], null, paged('events', 'VerificationEvent'), { queries: page });
add('get', '/facilities/me', 'Read your approved active associated facility', ['FACILITY_USER'], null, ref('Facility'));
add('get', '/donors/me/verification', 'Read your verification state (not medical clearance)', ['DONOR'], null, ref('Verification'));
add('get', '/donors/{donorId}/verification', 'Exact-ID minimal lookup within verification scope', ['FACILITY_USER'], null, ref('DonorLookup'), { permission: 'VERIFY_DONORS', description: 'Approved active facility required. A donor verified by another facility requires an authorized reverification workflow.' });
add('patch', '/donors/{donorId}/verification', 'Record professional profile/blood-group verification', ['FACILITY_USER'], 'VerificationInput', ref('Verification'), { permission: 'VERIFY_DONORS' });
add('get', '/donors/{donorId}/verification-history', 'Read only your facility verification events', ['FACILITY_USER'], null, paged('events', 'VerificationEvent'), { permission: 'VERIFY_DONORS', queries: page });
add('get', '/donors/me/location', 'Read only your own exact location and privacy state', ['DONOR'], null, ref('LocationState'));
add('put', '/donors/me/location', 'Upload device location with existing consent', ['DONOR'], 'GeoPoint', ref('LocationState'));
add('delete', '/donors/me/location', 'Erase coordinates/timestamp and revoke consent', ['DONOR'], 'Empty', ref('LocationState'));
add('patch', '/donors/me/availability', 'Set independent availability', ['DONOR'], 'AvailabilityInput', ref('LocationState'));
add('patch', '/donors/me/location-sharing', 'Set explicit consent; disabling erases location', ['DONOR'], 'ConsentInput', ref('LocationState'));
add('get', '/donors/me/donations', 'Read your confirmed donation history', ['DONOR'], null, paged('donations', 'Donation'), { queries: page });
add('post', '/requests', 'Create a request from stored facility location', ['FACILITY_USER'], 'RequestCreate', ref('BloodRequest'), { code: 201, permission: 'CREATE_BLOOD_REQUESTS' });
add('get', '/requests', 'List your facility requests (admins may inspect all)', ['FACILITY_USER', 'ADMIN'], null, paged('requests', 'BloodRequest'), { queries: requestQuery });
add('get', '/requests/{requestId}', 'Read an owned request (or admin view)', ['FACILITY_USER', 'ADMIN'], null, ref('BloodRequest'));
add('patch', '/requests/{requestId}/cancel', 'Cancel an active owned request', ['FACILITY_USER'], 'Reason', ref('BloodRequest'), { permission: 'MANAGE_BLOOD_REQUESTS' });
add('post', '/requests/{requestId}/broadcast', 'Create bounded deduplicated in-app notifications', ['FACILITY_USER'], 'BroadcastInput', ref('Broadcast'), { permission: 'MANAGE_BLOOD_REQUESTS', description: 'Stored request coordinates/blood type only. Starts locally; expand permits the next configured stage. Idempotency key reuse returns its original operation. Per-staff sensitive limit applies. No external delivery is simulated.' });
add('get', '/requests/{requestId}/responses', 'Read own request responses with minimal accepted contact', ['FACILITY_USER'], null, paged('responses', 'FacilityResponse'), { permission: 'MANAGE_BLOOD_REQUESTS', queries: page });
add('post', '/requests/{requestId}/donations', 'Confirm an actual accepted donation transactionally', ['FACILITY_USER'], 'DonationInput', ref('Donation'), { permission: 'CONFIRM_DONATIONS', description: 'One event per request/donor; identical retries are idempotent. Units cannot exceed remaining requirement. Acceptance is not donation or medical clearance.' });
add('get', '/requests/{requestId}/donations', 'Read confirmed donations for own facility request', ['FACILITY_USER'], null, paged('donations', 'Donation'), { permission: 'CONFIRM_DONATIONS', queries: page });
add('get', '/notifications', 'Read only your own in-app notifications', ['DONOR'], null, paged('notifications', 'Notification'), { queries: [...page, query('unread', str({ enum: ['true', 'false'] }))] });
add('patch', '/notifications/{notificationId}/read', 'Mark own notification read idempotently', ['DONOR'], 'Empty', ref('Notification'));
add('post', '/notifications/{notificationId}/response', 'Accept or decline your notification', ['DONOR'], 'ResponseInput', ref('DonorResponse'), { description: 'Request must be active. Acceptance rechecks current eligibility and matching pause. First response is final; identical retries are idempotent. Optional location cannot enable consent.' });
add('get', '/docs/openapi.json', 'Read this OpenAPI specification', ['PUBLIC'], null, { type: 'object', additionalProperties: true }, { publicRoute: true, raw: true });
const document = { openapi: '3.0.3', info: { title: 'LifeLink coordination backend', version: '1.0.0', description: 'A coordination prototype for The Gambia. Verification is not medical clearance; compatibility does not replace crossmatching; location freshness is not presence; donation pause is operational policy. Only in-app notifications are implemented. Examples are fictional. No arbitrary public donor matching/search API exists.' }, servers: [{ url: '/api/v1' }], paths, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas } };
writeFileSync(new URL('../docs/openapi.json', import.meta.url), JSON.stringify(document, null, 2) + '\n');
console.log(`Generated ${Object.values(paths).reduce((count, methods) => count + Object.keys(methods).length, 0)} documented operations.`);
