import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createItem,
  deleteItem,
  listItems,
  type ItemPayload,
} from '../services/itemsApi';

export function useItems(tenantId: string) {
  return useQuery({
    queryKey: ['items', tenantId],
    queryFn: () => listItems(tenantId),
  });
}

export function useCreateItem(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ItemPayload) => createItem(tenantId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['items', tenantId] }),
  });
}

export function useDeleteItem(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: number) => deleteItem(tenantId, itemId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['items', tenantId] }),
  });
}
