import type { ReactNode } from 'react';
import { AdminSidebar } from '../../components/organisms/AdminSidebar';
import './style.scss';

type AdminLayoutProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AdminLayout({
  title,
  subtitle,
  actions,
  children,
}: AdminLayoutProps) {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-layout-content">
        <header className="admin-layout-header">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="admin-layout-actions">{actions}</div> : null}
        </header>
        <main className="admin-layout-main">{children}</main>
      </div>
    </div>
  );
}
