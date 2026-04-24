import { apiRequest } from './apiClient';

export type Item = {
  id: number;
  tenant_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ItemPayload = {
  title: string;
  description?: string | null;
};

export function listItems(tenantId: string) {
  return apiRequest<{ items: Item[] }>(
    `/items?tenant=${encodeURIComponent(tenantId)}`,
  );
}

export function createItem(tenantId: string, payload: ItemPayload) {
  return apiRequest<{ item: Item }>(
    `/items?tenant=${encodeURIComponent(tenantId)}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function deleteItem(tenantId: string, itemId: number) {
  return apiRequest<{ deleted: boolean; item_id: number }>(
    `/items/${itemId}?tenant=${encodeURIComponent(tenantId)}`,
    { method: 'DELETE' },
  );
}
