// SMS delivery for sign-in codes. Configure with SMS_PROVIDER:
//   none    - SMS codes disabled (password sign-in only)
//   console - development only: prints the message to the server log
//   twilio  - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (sender number or alphanumeric ID)
export function createSmsProvider(config) {
  const kind = config.SMS_PROVIDER ?? 'none';
  if (kind === 'console') {
    if (config.NODE_ENV === 'production') return null;
    return { name: 'console', async send(to, text) { console.log(`[sms:console] to=${to} ${text}`); } };
  }
  if (kind === 'twilio') {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = config;
    if (!sid || !token || !from) return null;
    return {
      name: 'twilio',
      async send(to, text) {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
          method: 'POST',
          headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: to, From: from, Body: text }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`SMS provider responded ${res.status}`);
      },
    };
  }
  return null;
}
