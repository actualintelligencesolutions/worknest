import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/atoms/Button';
import { DataTable } from '../../../components/organisms/DataTable';
import { EmptyState } from '../../../components/organisms/EmptyState';
import { PageSection } from '../../../components/organisms/PageSection';
import { SummaryCard } from '../../../components/organisms/SummaryCard';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AdminLayout } from '../../../layouts/AdminLayout';
import { loadHrSession } from '../../../services/hrSession';
import {
  getCurrentActor,
  listCompanyLocations,
  listPayrollBatches,
} from '../../../services/worknestApi';
import '../shared.scss';

function formatPeriod(month: number, year: number) {
  return `${String(month).padStart(2, '0')}/${year}`;
}

export function OverviewPage() {
  usePageTitle('Overview');
  const session = loadHrSession();

  const actorQuery = useQuery({
    queryKey: ['auth-me', session?.tenantId],
    queryFn: () => getCurrentActor(session!),
    enabled: Boolean(session),
  });

  const locationsQuery = useQuery({
    queryKey: ['locations', session?.tenantId],
    queryFn: () => listCompanyLocations(session!),
    enabled: Boolean(session),
  });

  const batchesQuery = useQuery({
    queryKey: ['payroll-batches', session?.tenantId],
    queryFn: () => listPayrollBatches(session!),
    enabled: Boolean(session),
  });

  const summary = locationsQuery.data?.summary;
  const batches = batchesQuery.data?.batches ?? [];

  return (
    <AdminLayout
      title="Overview"
      subtitle="A minimal operational view of your workspace."
      actions={
        <div className="app-actions">
          <Button as={Link} to="/app/offices/new" variant="secondary">
            Create office
          </Button>
          <Button as={Link} to="/app/users" variant="secondary">
            Create user
          </Button>
          <Button as={Link} to="/app/payroll">
            Upload payroll
          </Button>
        </div>
      }
    >
      <div className="app-grid">
        {actorQuery.error ? (
          <div className="app-notice error">
            {(actorQuery.error as Error).message}
          </div>
        ) : null}

        <div className="app-grid-three">
          <SummaryCard
            helper="Main office plus branches."
            label="Total offices"
            value={summary?.total ?? '—'}
          />
          <SummaryCard
            helper="Only one main office is allowed."
            label="Main offices"
            value={summary?.main_offices ?? '—'}
          />
          <SummaryCard
            helper="Monthly payroll is branch scoped."
            label="Branches"
            value={summary?.branches ?? '—'}
          />
        </div>

        <PageSection
          title="Workspace"
          description="Tenant identity and current actor context."
        >
          <div className="app-card app-stack">
            <div className="app-list-row">
              <span>Workspace</span>
              <strong>{actorQuery.data?.actor.tenant_id ?? '—'}</strong>
            </div>
            <div className="app-list-row">
              <span>Signed in as</span>
              <strong>{actorQuery.data?.actor.name ?? '—'}</strong>
            </div>
            <div className="app-list-row">
              <span>Role</span>
              <strong>{actorQuery.data?.actor.user_type ?? '—'}</strong>
            </div>
          </div>
        </PageSection>

        <PageSection
          title="Recent payroll"
          description="Latest payroll batches available from the backend."
          actions={
            <Button as={Link} to="/app/payroll" variant="secondary">
              Open payroll
            </Button>
          }
        >
          {batches.length === 0 ? (
            <EmptyState
              title="No payroll batches yet"
              message="Upload a branch payroll file to start the monthly workflow."
              action={
                <Button as={Link} to="/app/payroll">
                  Upload payroll
                </Button>
              }
            />
          ) : (
            <DataTable columns={['Batch', 'Office', 'Period', 'Status']}>
              {batches.slice(0, 5).map((batch) => (
                <tr key={batch.id}>
                  <td>
                    <Link className="app-link" to={`/app/payroll/${batch.id}`}>
                      #{batch.id}
                    </Link>
                  </td>
                  <td>{batch.office_id}</td>
                  <td>{formatPeriod(batch.period_month, batch.period_year)}</td>
                  <td>
                    <span className={`app-status ${batch.upload_status}`}>
                      {batch.upload_status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </PageSection>
      </div>
    </AdminLayout>
  );
}
