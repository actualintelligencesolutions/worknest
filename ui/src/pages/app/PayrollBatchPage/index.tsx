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
  getPayrollBatch,
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

  const batchQuery = useQuery({
    queryKey: ['payroll-batch', session?.tenantId, batchId],
    queryFn: () => getPayrollBatch(session!, batchId),
    enabled: Boolean(session && batchId),
  });

  const batch = batchQuery.data?.batch;
  const office = batchQuery.data?.office;
  const records = batchQuery.data?.records ?? [];
  const validationSummary = batch?.validation_summary;
  const mappingEntries = Object.entries(batch?.mapping ?? {});
  const normalizedRows =
    validationSummary && 'normalized_rows' in validationSummary
      ? validationSummary.normalized_rows
      : [];

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payroll-batches', session.tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['payroll-batch', session.tenantId, batchId] }),
      ]);
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
        {batchQuery.isLoading ? (
          <div className="app-notice">Loading batch detail...</div>
        ) : !batch ? (
          <EmptyState
            title="Batch not found"
            message="The requested payroll batch is not available for this tenant session."
          />
        ) : (
          <>
            <div className="app-grid-three">
              <div className="app-card">
                <h3>Status</h3>
                <p>
                  <span className={`app-status ${batch.upload_status}`}>
                    {batch.upload_status.replace(/_/g, ' ')}
                  </span>
                </p>
              </div>
              <div className="app-card">
                <h3>Office</h3>
                <p>{office?.name ?? `Office #${batch.office_id}`}</p>
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
              description="This screen now reads the dedicated batch detail endpoint and shows the current processing state."
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
                  <td>Uploaded</td>
                  <td>{batch.uploaded_at ?? '—'}</td>
                </tr>
                <tr>
                  <td>Confirmed</td>
                  <td>{batch.confirmed_at ?? 'Not confirmed yet'}</td>
                </tr>
                <tr>
                  <td>Published</td>
                  <td>{batch.published_at ?? 'Not published yet'}</td>
                </tr>
              </DataTable>
            </PageSection>

            <PageSection
              title="Mapping"
              description="The stored source-to-field mapping used for validation and record creation."
            >
              {mappingEntries.length === 0 ? (
                <EmptyState
                  title="No mapping saved"
                  message="Save a column mapping from the payroll upload screen before validating this batch."
                />
              ) : (
                <DataTable columns={['Payroll field', 'Source column']}>
                  {mappingEntries.map(([field, source]) => (
                    <tr key={field}>
                      <td>{field.replace(/_/g, ' ')}</td>
                      <td>{source}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </PageSection>

            <PageSection
              title="Validation summary"
              description="A compact readout of the last validation run."
            >
              {!validationSummary || !('total_rows' in validationSummary) ? (
                <EmptyState
                  title="No validation summary"
                  message="Run validation to generate row counts and any critical payroll errors."
                />
              ) : (
                <div className="app-grid-two">
                  <div className="app-card">
                    <div className="app-list">
                      <div className="app-list-row">
                        <span>Total rows</span>
                        <strong>{validationSummary.total_rows}</strong>
                      </div>
                      <div className="app-list-row">
                        <span>Valid rows</span>
                        <strong>{validationSummary.valid_rows}</strong>
                      </div>
                      <div className="app-list-row">
                        <span>Error rows</span>
                        <strong>{validationSummary.error_rows}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="app-card">
                    <h3>Critical errors</h3>
                    {(validationSummary.critical_errors ?? []).length === 0 ? (
                      <p>No blocking validation errors were recorded.</p>
                    ) : (
                      <div className="app-list">
                        {validationSummary.critical_errors.map((error) => (
                          <div className="app-list-row" key={error}>
                            <span>{error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </PageSection>

            <PageSection
              title="Payroll records"
              description="Normalized employee-level records created after confirmation."
            >
              {records.length === 0 ? (
                <EmptyState
                  title="No payroll records"
                  message="Confirm the batch to create employee-level payroll records for publishing."
                />
              ) : (
                <DataTable columns={['Employee ID', 'Employee', 'Gross', 'Deductions', 'Net', 'Status']}>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.employee_id}</td>
                      <td>{record.employee_name_snapshot}</td>
                      <td>{record.gross_pay}</td>
                      <td>{record.total_deductions}</td>
                      <td>{record.net_pay}</td>
                      <td>
                        <span className={`app-status ${record.record_status}`}>
                          {record.record_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </PageSection>

            {Array.isArray(normalizedRows) && normalizedRows.length > 0 ? (
              <PageSection
                title="Validation preview"
                description="The first few normalized rows are shown for quick review."
              >
                <div className="app-card">
                  <pre>{JSON.stringify(normalizedRows.slice(0, 5), null, 2)}</pre>
                </div>
              </PageSection>
            ) : null}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
