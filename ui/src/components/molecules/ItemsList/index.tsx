import { useTranslation } from 'react-i18next';
import { Button } from '../../atoms/Button';
import type { Item } from '../../../services/itemsApi';
import './style.scss';

type ItemsListProps = {
  items: Item[];
  isLoading: boolean;
  error: Error | null;
  onDelete: (itemId: number) => void;
};

export function ItemsList({
  items,
  isLoading,
  error,
  onDelete,
}: ItemsListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <p className="muted">{t('common.loading')}</p>;
  }

  if (error) {
    return <p className="error">{t('common.error')}</p>;
  }

  if (items.length === 0) {
    return <p className="muted">{t('common.empty')}</p>;
  }

  return (
    <ul className="item-list">
      {items.map((item) => (
        <li key={item.id}>
          <div>
            <strong>{item.title}</strong>
            {item.description ? <p>{item.description}</p> : null}
          </div>
          <Button variant="secondary" onClick={() => onDelete(item.id)}>
            {t('common.delete')}
          </Button>
        </li>
      ))}
    </ul>
  );
}
