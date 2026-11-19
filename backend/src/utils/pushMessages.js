const display = t => t.replace('-', '−');
const link = (config, path) => (config.APP_URL ? config.APP_URL.replace(/\/$/, '') : '') + path;
export function requestAlertMessage(config, request, facility, { userId, notificationId }) {
  const urgent = request.urgency !== 'PLANNED';
  const units = request.unitsNeeded - (request.unitsReceived ?? 0);
  return {
    userId,
    urgent,
    tag: `request-${request._id}`,
    title: `${urgent ? 'URGENT: ' : ''}${display(request.patientBloodType)} blood needed`,
    body: `${facility?.name ?? 'A hospital'} needs ${units} unit${units === 1 ? '' : 's'}. Tap to respond.`,
    path: `/donor/notification/${notificationId}`,
    url: link(config, `/donor/notification/${notificationId}`),
  };
}
export function donorComingMessage(config, request, donor, staffId) {
  return {
    userId: staffId,
    urgent: true,
    tag: `response-${request._id}`,
    title: `${donor?.name?.split(' ')[0] ?? 'A donor'} is coming`,
    body: `A donor accepted your ${display(request.patientBloodType)} request.`,
    path: `/facility/request/${request._id}`,
    url: link(config, `/facility/request/${request._id}`),
  };
}
