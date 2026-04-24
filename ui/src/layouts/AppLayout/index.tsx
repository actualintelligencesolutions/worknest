import type { ReactNode } from 'react';
import { Header } from '../../components/organisms/Header';
import type { TenantConfig } from '../../config/tenants';
import './style.scss';

type AppLayoutProps = {
  tenant: TenantConfig;
  children: ReactNode;
};

export function AppLayout({ tenant, children }: AppLayoutProps) {
  void tenant;

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">{children}</main>
    </div>
  );
}
