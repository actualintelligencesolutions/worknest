import { useTranslation } from 'react-i18next';
import { ContactSections } from '../../../components/organisms/ContactSections';
import { AppLayout } from '../../../layouts/AppLayout';
import { useTenantStore } from '../../../stores/tenantStore';
import './style.scss';

export function ContactPage() {
  const { t } = useTranslation();
  const tenant = useTenantStore((state) => state.tenant);
  const pageConfig = tenant.pages.contact;

  return (
    <AppLayout tenant={tenant}>
      <section className="page-heading">
        <h2>{t(pageConfig.titleKey)}</h2>
        <p>{t(pageConfig.descriptionKey)}</p>
      </section>
      <ContactSections components={pageConfig.components} />
    </AppLayout>
  );
}
