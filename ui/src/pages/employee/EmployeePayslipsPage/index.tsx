import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/atoms/Button';
import { DataTable } from '../../../components/organisms/DataTable';
import { EmptyState } from '../../../components/organisms/EmptyState';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AppLayout } from '../../../layouts/AppLayout';
import {
  clearEmployeeSession,
  loadEmployeeSession,
} from '../../../services/employeeSession';
import { getCurrentActor, listPayslips, logoutSession } from '../../../services/worknestApi';
import { useTenantStore } from '../../../stores/tenantStore';
import '../shared.scss';

export function EmployeePayslipsPage() {
  usePageTitle('My payslips');
  const tenant = useTenantStore((state) => state.tenant);
  const session = loadEmployeeSession();
  const navigate = useNavigate();

  const actorQuery = useQuery({
    queryKey: ['employee-actor', session?.tenantId],
    queryFn: () => getCurrentActor(session!),
    enabled: Boolean(session),
  });

  const payslipsQuery = useQuery({
    queryKey: ['employee-payslips', session?.tenantId],
    queryFn: () => listPayslips(session!),
    enabled: Boolean(session),
  });

  async function handleLogout() {
    if (session) {
      try {
        await logoutSession(session);
      } catch {
        // Intentionally swallow logout network failures and clear local state.
      }
    }

    clearEmployeeSession();
    navigate('/employee/login');
  }

  const payslips = payslipsQuery.data?.payslips ?? [];
  const actor = actorQuery.data?.actor;

  return (
    <AppLayout tenant={tenant}>
      <div className="employee-shell">
        <div className="employee-stack">
          <section className="employee-panel">
            <div className="employee-actions">
              <div>
                <h1>My payslips</h1>
                <p>
                  {actor
                    ? `Signed in as ${actor.name}${actor.employee_id ? ` (${actor.employee_id})` : ''}.`
                    : 'Published payslips available to your employee account appear here.'}
                </p>
              </div>
              <Button onClick={handleLogout} type="button" variant="secondary">
                Logout
              </Button>
            </div>
          </section>

          <section className="employee-summary-grid">
            <div className="employee-summary-card">
              <span>Total payslips</span>
              <strong>{payslips.length}</strong>
            </div>
            <div className="employee-summary-card">
              <span>Workspace</span>
              <strong>{session?.tenantId ?? '—'}</strong>
            </div>
            <div className="employee-summary-card">
              <span>Current status</span>
              <strong>{actor?.status ?? 'Loading'}</strong>
            </div>
          </section>

          {actorQuery.isError || payslipsQuery.isError ? (
            <div className="employee-notice error">
              {(actorQuery.error as Error | undefined)?.message ??
                (payslipsQuery.error as Error | undefined)?.message ??
                'Unable to load employee data.'}
            </div>
          ) : null}

          <section className="employee-panel">
            {payslipsQuery.isLoading ? (
              <p>Loading payslips...</p>
            ) : payslips.length === 0 ? (
              <EmptyState
                title="No published payslips"
                message="Once your branch publishes a payroll batch, your payslips will appear here."
              />
            ) : (
              <DataTable columns={['Month', 'Gross', 'Deductions', 'Net', 'Action']}>
                {payslips.map((payslip) => (
                  <tr key={payslip.id}>
                    <td>
                      {payslip.period_month}/{payslip.period_year}
                    </td>
                    <td>{payslip.gross_pay}</td>
                    <td>{payslip.total_deductions}</td>
                    <td>{payslip.net_pay}</td>
                    <td>
                      <Link className="employee-link" to={`/employee/payslips/${payslip.id}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
