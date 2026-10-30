// Generated from backend/docs/openapi.json. Do not edit by hand.
export type Error = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
};
export type GeoPoint = { type: "Point"; coordinates: number[] };
export type Registration = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: "DONOR";
};
export type Login = { email: string; password: string };
export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "DONOR" | "FACILITY_USER" | "ADMIN";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Session = { user: User; accessToken: string; tokenType: "Bearer" };
export type FacilityCreate = {
  name: string;
  facilityType:
    "HOSPITAL" | "BLOOD_BANK" | "HEALTH_CENTRE" | "CLINIC" | "OTHER";
  referenceNumber?: string;
  phone: string;
  email: string;
  address: string;
};
export type FacilityTransition = {
  previousStatus: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  newStatus: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  performedBy: string;
  reason: string;
  timestamp: string;
};
export type Facility = {
  id: string;
  name: string;
  facilityType:
    "HOSPITAL" | "BLOOD_BANK" | "HEALTH_CENTRE" | "CLINIC" | "OTHER";
  phone: string;
  email: string;
  address: string;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  isActive: boolean;
  referenceNumber?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  statusHistory?: FacilityTransition[];
};
export type FacilityLocation = {
  facilityId: string;
  location: GeoPoint;
  locationUpdatedAt: string;
};
export type StaffCreate = {
  name: string;
  email: string;
  phone: string;
  password: string;
  permissions?: (
    | "VERIFY_DONORS"
    | "CREATE_BLOOD_REQUESTS"
    | "MANAGE_BLOOD_REQUESTS"
    | "CONFIRM_DONATIONS"
  )[];
};
export type Staff = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "FACILITY_USER";
  facilityId: string;
  permissions: (
    | "VERIFY_DONORS"
    | "CREATE_BLOOD_REQUESTS"
    | "MANAGE_BLOOD_REQUESTS"
    | "CONFIRM_DONATIONS"
  )[];
  isActive: boolean;
  createdAt: string;
};
export type Reason = { reason: string };
export type VerificationInput = {
  verifiedBloodType: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  notes?: string;
};
export type VerificationStatusInput = {
  status: "SUSPENDED" | "REQUIRES_REVERIFICATION";
  reason: string;
};
export type Verification = {
  verificationStatus:
    "UNVERIFIED" | "VERIFIED" | "SUSPENDED" | "REQUIRES_REVERIFICATION";
  verifiedBloodType:
    "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | null | null;
  verifiedAt: string | null;
  verifiedByFacility: {
    id: string;
    name: string;
    facilityType:
      "HOSPITAL" | "BLOOD_BANK" | "HEALTH_CENTRE" | "CLINIC" | "OTHER";
  } | null;
};
export type DonorLookup = {
  id: string;
  name: string;
  verificationStatus:
    "UNVERIFIED" | "VERIFIED" | "SUSPENDED" | "REQUIRES_REVERIFICATION";
  verifiedBloodType:
    "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | null | null;
};
export type VerificationEvent = {
  id: string;
  donorId: string;
  facilityId: string | null;
  performedBy: string;
  previousStatus:
    "UNVERIFIED" | "VERIFIED" | "SUSPENDED" | "REQUIRES_REVERIFICATION";
  newStatus:
    "UNVERIFIED" | "VERIFIED" | "SUSPENDED" | "REQUIRES_REVERIFICATION";
  verifiedBloodType:
    "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | null | null;
  reason?: string;
  notes?: string;
  sequence: number;
  timestamp: string;
};
export type AvailabilityInput = {
  availabilityStatus: "AVAILABLE" | "UNAVAILABLE";
};
export type ConsentInput = { locationSharingEnabled: boolean };
export type LocationState = {
  availabilityStatus: "AVAILABLE" | "UNAVAILABLE";
  locationSharingEnabled: boolean;
  hasLocation: boolean;
  currentLocation: { type: "Point"; coordinates: number[] } | null;
  locationUpdatedAt: string | null;
  isLocationFresh: boolean;
  locationReady: boolean;
};
export type RequestCreate = {
  patientBloodType: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  unitsNeeded: number;
  urgency: "CRITICAL" | "URGENT" | "PLANNED";
  expiresAt: string;
};
export type BloodRequest = {
  id: string;
  requestingFacility: string;
  createdBy: string;
  patientBloodType: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  unitsNeeded: number;
  unitsReceived: number;
  remainingUnits: number;
  urgency: "CRITICAL" | "URGENT" | "PLANNED";
  status: "OPEN" | "PARTIALLY_FILLED" | "FULFILLED" | "EXPIRED" | "CANCELLED";
  requestLocation: GeoPoint;
  expiresAt: string;
  fulfilledAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
};
export type BroadcastInput = {
  idempotencyKey: string;
  expand?: boolean;
  desiredCandidates?: number;
};
export type Broadcast = {
  id: string;
  bloodRequest: string;
  radiusUsedKm: number;
  candidateCount: number;
  notifiedCount: number;
  createdAt: string;
};
export type Notification = {
  id: string;
  responseStatus: "PENDING" | "ACCEPTED" | "DECLINED";
  channel: "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
  status: "DELIVERED" | "READ";
  sentAt: string;
  readAt: string | null;
  bloodRequest: {
    id: string;
    patientBloodType: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
    unitsNeeded: number;
    remainingUnits: number;
    urgency: "CRITICAL" | "URGENT" | "PLANNED";
    status: "OPEN" | "PARTIALLY_FILLED" | "FULFILLED" | "EXPIRED" | "CANCELLED";
    expiresAt: string;
    facility: { id: string; name: string; address: string } | null;
    actionable: boolean;
  } | null;
};
export type ResponseInput = {
  status: "ACCEPTED" | "DECLINED";
  location?: GeoPoint;
};
export type DonorResponse = {
  id: string;
  bloodRequest: string;
  status: "ACCEPTED" | "DECLINED";
  respondedAt: string;
};
export type FacilityResponse = {
  id: string;
  bloodRequest: string;
  status: "ACCEPTED" | "DECLINED";
  respondedAt: string;
  donor: {
    id: string;
    name: string;
    phone: string;
    verifiedBloodType: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  } | null;
};
export type DonationInput = { donorId: string; units: number };
export type Donation = {
  id: string;
  donorId: string;
  bloodRequest: string;
  facilityId: string;
  confirmedAt: string;
  units: number;
  bloodTypeSnapshot: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
};
export type AccountStatusInput = {
  isActive: boolean;
  reasonCode: "ACCOUNT_REVIEW" | "SECURITY_REVIEW" | "USER_REQUEST";
};
export type AccountStatus = {
  id: string;
  role: "DONOR" | "FACILITY_USER" | "ADMIN";
  isActive: boolean;
};
export type PermissionsInput = {
  permissions: (
    | "VERIFY_DONORS"
    | "CREATE_BLOOD_REQUESTS"
    | "MANAGE_BLOOD_REQUESTS"
    | "CONFIRM_DONATIONS"
  )[];
};
export type StaffPermissions = {
  id: string;
  facilityId: string;
  permissions: (
    | "VERIFY_DONORS"
    | "CREATE_BLOOD_REQUESTS"
    | "MANAGE_BLOOD_REQUESTS"
    | "CONFIRM_DONATIONS"
  )[];
};
export type AuditMetadata = {
  previousStatus?: string;
  newStatus?: string;
  units?: number;
  radiusKm?: number;
  notificationCount?: number;
  isActive?: boolean;
  permissions?: (
    | "VERIFY_DONORS"
    | "CREATE_BLOOD_REQUESTS"
    | "MANAGE_BLOOD_REQUESTS"
    | "CONFIRM_DONATIONS"
  )[];
  reasonCode?: "ACCOUNT_REVIEW" | "SECURITY_REVIEW" | "USER_REQUEST";
};
export type AuditLog = {
  id: string;
  actor: string;
  actorRole: "DONOR" | "FACILITY_USER" | "ADMIN";
  action:
    | "FACILITY_CREATED"
    | "FACILITY_APPROVED"
    | "FACILITY_REJECTED"
    | "FACILITY_SUSPENDED"
    | "FACILITY_REACTIVATED"
    | "FACILITY_LOCATION_CHANGED"
    | "STAFF_PROVISIONED"
    | "STAFF_PERMISSIONS_CHANGED"
    | "DONOR_VERIFIED"
    | "DONOR_VERIFICATION_CHANGED"
    | "REQUEST_CREATED"
    | "REQUEST_CANCELLED"
    | "BROADCAST_INITIATED"
    | "DONOR_RESPONDED"
    | "DONATION_CONFIRMED"
    | "ACCOUNT_STATUS_CHANGED"
    | "ADMIN_BOOTSTRAPPED";
  targetType:
    "Facility" | "User" | "BloodRequest" | "Donation" | "DonorResponse";
  targetId: string;
  facilityId?: string;
  timestamp: string;
  metadata: AuditMetadata;
};
export type Stats = {
  donors: number;
  verifiedDonors: number;
  availableDonors: number;
  approvedFacilities: number;
  openRequests: number;
  fulfilledRequests: number;
  confirmedDonations: number;
};
export type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};
export type Empty = Record<string, never>;
