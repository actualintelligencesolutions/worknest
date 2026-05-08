import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../../components/atoms/Button';
import { EmptyState } from '../../../components/organisms/EmptyState';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AppLayout } from '../../../layouts/AppLayout';
import { loadEmployeeSession } from '../../../services/employeeSession';
import { downloadPayslip, getPayslip } from '../../../services/worknestApi';
import { useTenantStore } from '../../../stores/tenantStore';
import '../shared.scss';

export function EmployeePayslipDetailPage() {
  usePageTitle('Payslip detail');
  const tenant = useTenantStore((state) => state.tenant);
  const session = loadEmployeeSession();
  const { id = '' } = useParams();
  const payslipId = Number(id);

  const payslipQuery = useQuery({
    queryKey: ['employee-payslip', session?.tenantId, payslipId],
    queryFn: () => getPayslip(session!, payslipId),
    enabled: Boolean(session && payslipId),
  });

  async function handleDownload() {
    if (!session || !payslipId) {
      return;
    }

    const blob = await downloadPayslip(session, payslipId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `worknest-payslip-${payslipId}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const payslip = payslipQuery.data?.payslip;

  return (
    <AppLayout tenant={tenant}>
      <div className="employee-shell">
        <div className="employee-stack">
          <section className="employee-panel">
            <div className="employee-actions">
              <div>
                <h1>Payslip detail</h1>
                <p>Review the published payroll snapshot and download the PDF when needed.</p>
              </div>
              <Button as={Link} to="/employee/payslips" variant="secondary">
                Back to payslips
              </Button>
            </div>
          </section>

          {payslipQuery.isError ? (
            <div className="employee-notice error">
              {(payslipQuery.error as Error).message}
            </div>
          ) : null}

          {!payslip && payslipQuery.isLoading ? (
            <section className="employee-panel">
              <p>Loading payslip...</p>
            </section>
          ) : null}

          {!payslip && !payslipQuery.isLoading ? (
            <EmptyState
              title="Payslip not found"
              message="The requested payslip is not available to this employee session."
            />
          ) : null}

          {payslip ? (
            <>
              <section className="employee-panel">
                <div className="employee-meta">
                  <div className="employee-meta-row">
                    <strong>Period</strong>
                    <span>
                      {payslip.period_month}/{payslip.period_year}
                    </span>
                  </div>
                  <div className="employee-meta-row">
                    <strong>Employee</strong>
                    <span>{payslip.employee_name_snapshot ?? payslip.employee_name ?? '—'}</span>
                  </div>
                  <div className="employee-meta-row">
                    <strong>Gross pay</strong>
                    <span>{payslip.gross_pay}</span>
                  </div>
                  <div className="employee-meta-row">
                    <strong>Total deductions</strong>
                    <span>{payslip.total_deductions}</span>
                  </div>
                  <div className="employee-meta-row">
                    <strong>Net pay</strong>
                    <span>{payslip.net_pay}</span>
                  </div>
                  <div className="employee-meta-row">
                    <strong>Status</strong>
                    <span>{payslip.status}</span>
                  </div>
                </div>
              </section>

              <section className="employee-panel">
                <div className="employee-actions">
                  <Button onClick={handleDownload} type="button">
                    Download PDF
                  </Button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
