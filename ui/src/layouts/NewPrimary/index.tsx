import type { ReactNode } from 'react';
import { NewHeader } from '../../components/organisms/NewHeader';
import type { NewHeaderNavItem } from '../../config/newHeader';
import './style.scss';

type NewPrimaryLayoutProps = {
  children: ReactNode;
  pageHeader?: ReactNode;
  headerNavItems?: NewHeaderNavItem[];
  onLogout?: () => void | Promise<void>;
};

export function NewPrimaryLayout({
  children,
  pageHeader,
  headerNavItems,
  onLogout,
}: NewPrimaryLayoutProps) {
  return (
    <div className="new-primary-layout">
      <NewHeader navItems={headerNavItems} onLogout={onLogout} />
      <main className="new-primary-layout-main">
        {pageHeader ? <div className="new-primary-layout-page-header">{pageHeader}</div> : null}
        <div className="new-primary-layout-content">{children}</div>
      </main>
    </div>
  );
}
