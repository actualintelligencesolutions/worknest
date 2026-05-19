import type { ReactNode } from 'react';
import { NewHeader } from '../../components/organisms/NewHeader';
import type { NewHeaderNavItem } from '../../config/newHeader';
import './style.scss';

type NewPrimaryLayoutProps = {
  children: ReactNode;
  pageHeader?: ReactNode;
  headerNavItems?: NewHeaderNavItem[];
  headerVariant?: 'default' | 'quiet';
  onLogout?: () => void | Promise<void>;
  headerBrandPath?: string;
};

export function NewPrimaryLayout({
  children,
  pageHeader,
  headerNavItems,
  headerVariant = 'default',
  onLogout,
  headerBrandPath,
}: NewPrimaryLayoutProps) {
  return (
    <div className="new-primary-layout">
      <NewHeader brandPath={headerBrandPath} navItems={headerNavItems} onLogout={onLogout} variant={headerVariant} />
      <main className="new-primary-layout-main">
        {pageHeader ? <div className="new-primary-layout-page-header">{pageHeader}</div> : null}
        <div className="new-primary-layout-content">{children}</div>
      </main>
    </div>
  );
}
