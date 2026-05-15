import type { ReactNode } from 'react';
import { MarketingHeader } from '../../components/organisms/MarketingHeader';
import './style.scss';

type MarketingLayoutProps = {
  children: ReactNode;
};

export function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="marketing-layout">
      <MarketingHeader />
      <main className="marketing-layout-main">{children}</main>
    </div>
  );
}
