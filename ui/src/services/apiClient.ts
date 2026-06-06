export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
};

export class ApiRequestError extends Error {
  code?: string;
  details?: Record<string, unknown>;
}

const API_BASE_URL = 'https://www.worknestapp.com/api';
export const RESOLVED_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? API_BASE_URL;

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const response = await fetch(`${RESOLVED_API_BASE_URL}${path}`, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !envelope.success || envelope.data === null) {
    const error = new ApiRequestError(envelope.error?.message ?? 'API request failed');
    error.code = envelope.error?.code;
    error.details = envelope.error?.details;
    throw error;
  }

  return envelope.data;
}
