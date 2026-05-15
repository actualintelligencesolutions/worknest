import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../../hooks/usePageTitle';
import { NewPrimaryLayout } from '../../layouts/NewPrimary';
import './style.scss';

type NewDashSectionPageProps = {
  titleKey: string;
  descriptionKey: string;
};

export function NewDashSectionPage({
  titleKey,
  descriptionKey,
}: NewDashSectionPageProps) {
  const { t } = useTranslation();

  usePageTitle(t(titleKey));

  return (
    <NewPrimaryLayout>
      <section className="new-dash-page">
        <p className="eyebrow">{t('pages.newDash.eyebrow')}</p>
        <h1>{t(titleKey)}</h1>
        <p className="new-dash-page-copy">{t(descriptionKey)}</p>
      </section>
    </NewPrimaryLayout>
  );
}
