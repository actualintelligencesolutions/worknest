import type { ReactNode } from 'react';
import { MarketingHeader } from '../../components/organisms/MarketingHeader';
import './style.scss';

type MarketingLayoutProps = {
  children: ReactNode;
  withoutHeader?: boolean;
};

export function MarketingLayout({ children, withoutHeader = false }: MarketingLayoutProps) {
  return (
    <div className="marketing-layout">
      {!withoutHeader ? <MarketingHeader /> : null}
      <main className="marketing-layout-main">{children}</main>
    </div>
  );
}
