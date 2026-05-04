import { useQuery } from '@tanstack/react-query';
import { Button } from '../../../components/atoms/Button';
import { DataTable } from '../../../components/organisms/DataTable';
import { PageSection } from '../../../components/organisms/PageSection';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AdminLayout } from '../../../layouts/AdminLayout';
import {
  clearHrSession,
} from '../../../services/hrSession';
import { getCurrentActor, logoutSession } from '../../../services/worknestApi';
import { loadHrSession } from '../../../services/hrSession';
import '../shared.scss';

export function SettingsPage() {
  usePageTitle('Settings');
  const session = loadHrSession();
  const actorQuery = useQuery({
    queryKey: ['auth-me', session?.tenantId],
    queryFn: () => getCurrentActor(session!),
    enabled: Boolean(session),
  });

  async function handleLogout() {
    if (session) {
      try {
        await logoutSession(session);
      } catch {
        // Keep logout resilient even if the backend session revoke fails.
      }
    }
    clearHrSession();
    window.location.assign('/login');
  }

  return (
    <AdminLayout
      title="Settings"
      subtitle="Tenant and session details, kept intentionally lightweight."
      actions={
        <Button onClick={handleLogout} type="button" variant="secondary">
          Logout
        </Button>
      }
    >
      <div className="app-grid-two">
        <PageSection title="Current actor">
          <DataTable columns={['Field', 'Value']}>
            <tr>
              <td>Name</td>
              <td>{actorQuery.data?.actor.name ?? '—'}</td>
            </tr>
            <tr>
              <td>Email</td>
              <td>{actorQuery.data?.actor.email ?? '—'}</td>
            </tr>
            <tr>
              <td>Role</td>
              <td>{actorQuery.data?.actor.user_type ?? '—'}</td>
            </tr>
          </DataTable>
        </PageSection>

        <PageSection title="Workspace">
          <DataTable columns={['Field', 'Value']}>
            <tr>
              <td>Tenant</td>
              <td>{actorQuery.data?.actor.tenant_id ?? '—'}</td>
            </tr>
            <tr>
              <td>Accessible offices</td>
              <td>{actorQuery.data?.actor.office_ids.join(', ') || 'Tenant-wide'}</td>
            </tr>
            <tr>
              <td>Notes</td>
              <td>Billing and audit screens are deferred in this minimal pass.</td>
            </tr>
          </DataTable>
        </PageSection>
      </div>
    </AdminLayout>
  );
}
