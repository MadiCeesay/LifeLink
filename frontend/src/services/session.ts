import type { Session, User } from "../types/api";
export type SessionPorts = {
  authenticate: (kind: "login" | "register", body: unknown) => Promise<Session>;
  identify: () => Promise<{ user: User }>;
  write: (token: string) => Promise<void>;
  erase: () => Promise<void>;
  attach: (token: string | null) => void;
  clearCache: () => Promise<void>;
};
export async function establishSession(
  kind: "login" | "register",
  body: unknown,
  p: SessionPorts,
) {
  await p.clearCache();
  p.attach(null);
  await p.erase();
  try {
    const session = await p.authenticate(kind, body);
    p.attach(session.accessToken);
    const identity = await p.identify();
    await p.write(session.accessToken);
    return identity.user;
  } catch (error) {
    p.attach(null);
    await p.erase();
    throw error;
  }
}
export async function clearSession(
  p: Pick<SessionPorts, "attach" | "erase" | "clearCache">,
) {
  p.attach(null);
  await p.clearCache();
  await p.erase();
}
