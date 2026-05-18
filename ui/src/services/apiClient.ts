export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
};

const API_BASE_URL = 'https://preview.worknestapp.com/api';
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
    throw new Error(envelope.error?.message ?? 'API request failed');
  }

  return envelope.data;
}
