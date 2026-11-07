// A response belongs to the session in which its request started.
let revision = 0;
export class StaleSessionError extends Error {
  constructor() { super('Session changed while the request was pending.'); }
}
export const sessionRevision = () => revision;
export const isCurrentSession = value => value === revision;
export function advanceSession() { revision++; }
export function assertCurrentSession(value) {
  if (!isCurrentSession(value)) throw new StaleSessionError();
}
