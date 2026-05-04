import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/atoms/Button';
import { Field } from '../../../components/atoms/Field';
import { DataTable } from '../../../components/organisms/DataTable';
import { EmptyState } from '../../../components/organisms/EmptyState';
import { PageSection } from '../../../components/organisms/PageSection';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AdminLayout } from '../../../layouts/AdminLayout';
import { loadHrSession } from '../../../services/hrSession';
import {
  listCompanyLocations,
  listPayrollBatches,
  saveBatchMapping,
  uploadPayrollBatch,
  validateBatch,
  type PayrollBatchUploadResponse,
} from '../../../services/worknestApi';
import '../shared.scss';

export function PayrollPage() {
  usePageTitle('Payroll');
  const session = loadHrSession();
  const queryClient = useQueryClient();
  const [officeId, setOfficeId] = useState('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [periodYear, setPeriodYear] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<PayrollBatchUploadResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<string | null>(null);

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

  const branchOptions = (locationsQuery.data?.locations ?? []).filter(
    (location) => location.location_type === 'branch',
  );

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !file || !officeId || !periodMonth || !periodYear) {
      return;
    }

    try {
      const result = await uploadPayrollBatch(session, {
        office_id: Number(officeId),
        period_month: Number(periodMonth),
        period_year: Number(periodYear),
        file,
      });
      setUploadResult(result);
      setMapping(
        Object.fromEntries(
          Object.entries(result.mapping_suggestions).map(([field, suggestion]) => [
            field,
            suggestion.source,
          ]),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ['payroll-batches', session.tenantId] });
      setNotice('Payroll file uploaded. Review the suggested mapping below.');
      setValidationState(null);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function handleSaveMapping() {
    if (!session || !uploadResult) {
      return;
    }

    try {
      await saveBatchMapping(session, uploadResult.batch.id, mapping);
      const validation = await validateBatch(session, uploadResult.batch.id);
      setValidationState(
        `Validated ${validation.summary.valid_rows}/${validation.summary.total_rows} rows.`,
      );
      setNotice('Mapping saved and validation completed.');
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  return (
    <AdminLayout
      title="Payroll"
      subtitle="A minimal batch-based payroll workflow wired to real endpoints."
    >
      <div className="app-grid-two">
        <PageSection title="Upload batch">
          {notice ? <div className="app-notice">{notice}</div> : null}
          <form className="app-card app-inline-form" onSubmit={handleUpload}>
            <Field label="Branch office">
              <select onChange={(event) => setOfficeId(event.target.value)} value={officeId}>
                <option value="">Select branch</option>
                {branchOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="app-grid-two">
              <Field label="Month">
                <input
                  max="12"
                  min="1"
                  onChange={(event) => setPeriodMonth(event.target.value)}
                  type="number"
                  value={periodMonth}
                />
              </Field>
              <Field label="Year">
                <input
                  onChange={(event) => setPeriodYear(event.target.value)}
                  type="number"
                  value={periodYear}
                />
              </Field>
            </div>
            <Field label="Payroll file">
              <input
                accept=".csv,.xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </Field>
            <Button disabled={!officeId || !periodMonth || !periodYear || !file}>
              Upload batch
            </Button>
          </form>
        </PageSection>

        <PageSection title="Current batches">
          {(batchesQuery.data?.batches ?? []).length === 0 ? (
            <EmptyState
              title="No payroll batches"
              message="Once you upload payroll, the monthly batch history will appear here."
            />
          ) : (
            <DataTable columns={['Batch', 'Office', 'Period', 'Status']}>
              {(batchesQuery.data?.batches ?? []).map((batch) => (
                <tr key={batch.id}>
                  <td>
                    <Link className="app-link" to={`/app/payroll/${batch.id}`}>
                      #{batch.id}
                    </Link>
                  </td>
                  <td>{batch.office_id}</td>
                  <td>
                    {batch.period_month}/{batch.period_year}
                  </td>
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

      <PageSection
        actions={
          uploadResult ? (
            <Button onClick={handleSaveMapping} type="button">
              Save mapping and validate
            </Button>
          ) : null
        }
        title="Mapping review"
        description="This remains intentionally simple: review suggested columns, then validate."
      >
        {!uploadResult ? (
          <EmptyState
            title="No uploaded batch selected"
            message="Upload a payroll file to see headers, sample rows, and field mapping."
          />
        ) : (
          <div className="app-grid-two">
            <div className="app-card app-inline-form">
              {['employee_id', 'employee_name', 'gross_pay', 'total_deductions', 'net_pay'].map(
                (field) => (
                  <Field key={field} label={field.replace(/_/g, ' ')}>
                    <select
                      onChange={(event) =>
                        setMapping((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      value={mapping[field] ?? ''}
                    >
                      <option value="">Select column</option>
                      {uploadResult.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </Field>
                ),
              )}
            </div>
            <div className="app-card app-stack">
              <h3>Sample rows</h3>
              <pre>{JSON.stringify(uploadResult.sample_rows, null, 2)}</pre>
              <div className="app-notice">
                Confirm and publish actions are available on the batch detail page after runtime verification.
              </div>
              {validationState ? <div className="app-notice success">{validationState}</div> : null}
            </div>
          </div>
        )}
      </PageSection>
    </AdminLayout>
  );
}
