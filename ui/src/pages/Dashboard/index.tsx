import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppLayout } from '../../layouts/AppLayout';
import { useTenantStore } from '../../stores/tenantStore';
import './style.scss';

const setupActions = [
  {
    title: 'Setup Main Office',
    description:
      'Create the company head office profile before adding other locations.',
    to: '/dashboard/main-office',
  },
  {
    title: 'Setup a branch',
    description:
      'Add a branch location when the company structure is ready to expand.',
    to: '/dashboard/branches/new',
  },
];

export function DashboardPage() {
  const tenant = useTenantStore((state) => state.tenant);
  usePageTitle('Dashboard');

  return (
    <AppLayout tenant={tenant}>
      <section className="dashboard-page" aria-labelledby="dashboard-title">
        <div className="dashboard-heading">
          <p className="eyebrow">Dashboard</p>
          <h1 id="dashboard-title">Finish your workspace setup</h1>
        </div>

        <div className="dashboard-actions" aria-label="Setup actions">
          {setupActions.map((action) => (
            <Link
              className="dashboard-action"
              key={action.title}
              to={action.to}
            >
              <span>{action.title}</span>
              <small>{action.description}</small>
            </Link>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
