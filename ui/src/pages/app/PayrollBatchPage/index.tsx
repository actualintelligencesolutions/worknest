import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../../components/atoms/Button';
import { DataTable } from '../../../components/organisms/DataTable';
import { EmptyState } from '../../../components/organisms/EmptyState';
import { PageSection } from '../../../components/organisms/PageSection';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AdminLayout } from '../../../layouts/AdminLayout';
import { loadHrSession } from '../../../services/hrSession';
import {
  confirmBatch,
  listPayrollBatches,
  publishBatch,
  validateBatch,
} from '../../../services/worknestApi';
import '../shared.scss';

export function PayrollBatchPage() {
  usePageTitle('Payroll batch');
  const session = loadHrSession();
  const queryClient = useQueryClient();
  const { id = '' } = useParams();
  const batchId = Number(id);
  const [notice, setNotice] = useState<string | null>(null);

  const batchesQuery = useQuery({
    queryKey: ['payroll-batches', session?.tenantId],
    queryFn: () => listPayrollBatches(session!),
    enabled: Boolean(session),
  });

  const batch = (batchesQuery.data?.batches ?? []).find((item) => item.id === batchId);

  async function runAction(
    action: 'validate' | 'confirm' | 'publish',
  ) {
    if (!session || !batchId) {
      return;
    }

    try {
      if (action === 'validate') {
        const result = await validateBatch(session, batchId);
        setNotice(
          `Validated ${result.summary.valid_rows}/${result.summary.total_rows} rows.`,
        );
      }
      if (action === 'confirm') {
        const result = await confirmBatch(session, batchId);
        setNotice(`Created ${result.records_created} payroll records.`);
      }
      if (action === 'publish') {
        const result = await publishBatch(session, batchId);
        setNotice(`Published ${result.summary.payslips_generated} payslips.`);
      }
      await queryClient.invalidateQueries({ queryKey: ['payroll-batches', session.tenantId] });
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  return (
    <AdminLayout
      title={batch ? `Payroll Batch #${batch.id}` : 'Payroll batch'}
      subtitle="Minimal action surface for validation, confirmation, and publishing."
      actions={
        <Button as={Link} to="/app/payroll" variant="secondary">
          Back to payroll
        </Button>
      }
    >
      <div className="app-grid">
        {notice ? <div className="app-notice">{notice}</div> : null}
        {!batch ? (
          <EmptyState
            title="Batch not found"
            message="This view currently resolves batches from the list endpoint."
          />
        ) : (
          <>
            <div className="app-grid-three">
              <div className="app-card">
                <h3>Status</h3>
                <p>{batch.upload_status}</p>
              </div>
              <div className="app-card">
                <h3>Office</h3>
                <p>{batch.office_id}</p>
              </div>
              <div className="app-card">
                <h3>Period</h3>
                <p>
                  {batch.period_month}/{batch.period_year}
                </p>
              </div>
            </div>

            <PageSection
              actions={
                <div className="app-actions">
                  <Button onClick={() => runAction('validate')} type="button" variant="secondary">
                    Validate
                  </Button>
                  <Button onClick={() => runAction('confirm')} type="button" variant="secondary">
                    Confirm
                  </Button>
                  <Button onClick={() => runAction('publish')} type="button">
                    Publish
                  </Button>
                </div>
              }
              title="Batch actions"
              description="These actions call the real backend routes directly."
            >
              <DataTable columns={['Field', 'Value']}>
                <tr>
                  <td>Source file</td>
                  <td>{batch.source_file_name}</td>
                </tr>
                <tr>
                  <td>Created</td>
                  <td>{batch.created_at ?? '—'}</td>
                </tr>
                <tr>
                  <td>Validation summary</td>
                  <td>{batch.validation_summary_json ?? 'Available after validation'}</td>
                </tr>
              </DataTable>
            </PageSection>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
