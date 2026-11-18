export interface ApiOptions {
  method?: string;
  body?: URLSearchParams | Record<string, unknown> | null;
  headers?: Record<string, string>;
  retryCsrf?: boolean;
}

export class ApiError extends Error {
  status: number;
  code: string;
}

export function api(path: string, options?: ApiOptions): Promise<any>;
export function renewCsrf(): Promise<unknown>;
export function onUnauthorized(handler: () => void): void;
