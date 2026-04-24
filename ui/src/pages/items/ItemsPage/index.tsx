import { useTranslation } from 'react-i18next';
import { ItemsPanel } from '../../../components/organisms/ItemsPanel';
import { AppLayout } from '../../../layouts/AppLayout';
import {
  useCreateItem,
  useDeleteItem,
  useItems,
} from '../../../hooks/useItems';
import { useTenantStore } from '../../../stores/tenantStore';
import './style.scss';

export function ItemsPage() {
  const { t } = useTranslation();
  const tenant = useTenantStore((state) => state.tenant);
  const pageConfig = tenant.pages.items;
  const itemsQuery = useItems(tenant.tenantId);
  const createItem = useCreateItem(tenant.tenantId);
  const deleteItem = useDeleteItem(tenant.tenantId);

  return (
    <AppLayout tenant={tenant}>
      <section className="page-heading">
        <h2>{t(pageConfig.titleKey)}</h2>
        <p>{t(pageConfig.descriptionKey)}</p>
      </section>
      <ItemsPanel
        components={pageConfig.components}
        items={itemsQuery.data?.items ?? []}
        isLoading={itemsQuery.isLoading}
        error={itemsQuery.error}
        onCreate={(payload) => createItem.mutate(payload)}
        onDelete={(itemId) => deleteItem.mutate(itemId)}
      />
    </AppLayout>
  );
}
