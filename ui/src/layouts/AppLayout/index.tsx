import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/organisms/AppHeader';
import type { TenantConfig } from '../../config/tenants';
import './style.scss';

type AppLayoutProps = {
  tenant: TenantConfig;
  children: ReactNode;
};

export function AppLayout({ tenant, children }: AppLayoutProps) {
  const { t } = useTranslation();
  const navigation = Object.values(tenant.pages)
    .filter((page) => page.enabled)
    .map((page) => ({
      label: t(page.navLabelKey),
      path: page.path,
    }));

  return (
    <div className="app-shell">
      <AppHeader
        title={t(tenant.branding.appNameKey)}
        subtitle={t(tenant.branding.taglineKey)}
        navigation={navigation}
      />
      <main className="app-main">{children}</main>
    </div>
  );
}
