import { useTranslation } from 'react-i18next';
import { ItemsForm } from '../../molecules/ItemsForm';
import { ItemsList } from '../../molecules/ItemsList';
import type { Item } from '../../../services/itemsApi';
import './style.scss';

type ItemsPanelProps = {
  components: string[];
  items: Item[];
  isLoading: boolean;
  error: Error | null;
  onCreate: (payload: { title: string; description?: string | null }) => void;
  onDelete: (itemId: number) => void;
};

export function ItemsPanel({
  components,
  items,
  isLoading,
  error,
  onCreate,
  onDelete,
}: ItemsPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel">
      {components.includes('itemsForm') ? (
        <section>
          <h2>{t('pages.items.createTitle')}</h2>
          <ItemsForm onSubmit={onCreate} />
        </section>
      ) : null}

      {components.includes('itemsList') ? (
        <section>
          <h2>{t('pages.items.listTitle')}</h2>
          <ItemsList
            items={items}
            isLoading={isLoading}
            error={error}
            onDelete={onDelete}
          />
        </section>
      ) : null}
    </section>
  );
}
