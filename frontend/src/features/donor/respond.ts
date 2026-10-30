import type { Notification, GeoPoint } from "../../types/api";
import { isActiveRequest } from "../../utils/domain";
type Dependencies = {
  refresh: () => Promise<Notification | undefined>;
  consent: () => Promise<boolean>;
  location: () => Promise<GeoPoint>;
  submit: (body: {
    status: "ACCEPTED" | "DECLINED";
    location?: GeoPoint;
  }) => Promise<unknown>;
};
export async function submitResponse(
  status: "ACCEPTED" | "DECLINED",
  deps: Dependencies,
) {
  const latest = await deps.refresh();
  if (
    !latest?.bloodRequest?.actionable ||
    !isActiveRequest(latest.bloodRequest) ||
    latest.responseStatus !== "PENDING"
  )
    throw new Error("This request is no longer open for a new response.");
  if (status === "DECLINED") return deps.submit({ status });
  if (!(await deps.consent()))
    throw new Error(
      "Enable location sharing in your profile before accepting.",
    );
  const location = await deps.location();
  return deps.submit({ status, location });
}
