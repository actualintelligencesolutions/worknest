import { useTranslation } from 'react-i18next';
import { AboutSections } from '../../../components/organisms/AboutSections';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AppLayout } from '../../../layouts/AppLayout';
import { useTenantStore } from '../../../stores/tenantStore';
import './style.scss';

export function AboutPage() {
  const { t } = useTranslation();
  const tenant = useTenantStore((state) => state.tenant);
  const pageConfig = tenant.pages.about;
  usePageTitle(t(pageConfig.titleKey));

  return (
    <AppLayout tenant={tenant}>
      <section className="page-heading">
        <h2>{t(pageConfig.titleKey)}</h2>
        <p>{t(pageConfig.descriptionKey)}</p>
      </section>
      <AboutSections components={pageConfig.components} />
    </AppLayout>
  );
}
