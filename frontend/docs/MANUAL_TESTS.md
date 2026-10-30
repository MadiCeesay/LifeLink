# Device and staging acceptance

Record device model, OS, Expo/build version, API deployment and result for each check. Do not use patient information. Do not record passwords, bearer tokens or exact donor coordinates in screenshots/logs.

1. Start backend and verify health. Configure a reachable API URL; launch on a small Android phone, then an iPhone when available.
2. Welcome: text readable with large font setting, safe-area and keyboard do not hide controls, touch targets remain usable.
3. Register donor: supported identity only, initially unverified; wrong email/phone/short password show inline errors. Duplicate email shows server failure. No role picker exists.
4. Login each role. Manually deep-link to another role: protected navigation redirects. Logout and account switch: previous role records disappear. Relaunch restores native session; expired/deactivated session signs out.
5. Admin creates pending facility, approves, sets origin while physically there, provisions staff, and sets the intended explicit permissions. Record returned staff ID privately. Denied permissions must show server 403, never success.
6. Facility enters donor's exact ID and records professional verification. Donor profile refetches verified blood type. No donor directory exists.
7. Donor sets availability. Grant sharing after explanation, OS prompt and actual device fix. Test denied OS permission, location services disabled, no connection and timeout. Check disable-sharing erases state and re-enable requires a new fix. No exact GPS is visible.
8. Facility creates request within server expiry limit. Broadcast privately. Retry a network-failed broadcast with the retained operation key; confirm no duplicate notifications. Expansion uses only the next backend stage.
9. Donor inbox shows the real notification, read state and current request. Accept with current consent/location; decline without location. Test request expiry/cancellation between opening and submitting. A submitted response is final.
10. Owning staff sees safe contact only where returned. Confirm an actual accepted donation after reviewing donor, request and units. Refresh request and donor history; verify partial/full server status. Other facilities cannot access request/contact.
11. Admin checks real stats, audit and minimal donation history. Account self-lockout is unavailable and backend errors are visible. No audit editing exists.
12. Airplane mode and slow network show bounded loading and retry; no false success. Reconnect/refocus refreshes identity and query state. Back/navigation after logout must not reopen sensitive views.

These are manual acceptance steps, not claims they have all been executed.
