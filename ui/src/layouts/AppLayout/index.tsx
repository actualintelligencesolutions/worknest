import type { ReactNode } from 'react';
import { Header } from '../../components/organisms/Header';
import type { TenantConfig } from '../../config/tenants';
import './style.scss';

type AppLayoutProps = {
  tenant: TenantConfig;
  children: ReactNode;
  fullWidth?: boolean;
};

export function AppLayout({ tenant, children, fullWidth = false }: AppLayoutProps) {
  void tenant;

  return (
    <div className="app-shell">
      <Header />
      <main className={fullWidth ? 'app-main app-main-full' : 'app-main'}>
        {children}
      </main>
    </div>
  );
}
