import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { PageHeader } from '../../components/organisms/PageHeader';
import { usePageTitle } from '../../hooks/usePageTitle';
import { NewPrimaryLayout } from '../../layouts/NewPrimary';
import { loadHrSession } from '../../services/hrSession';
import {
  getCurrentActor,
  getOffice,
  getPayrollBatch,
  listPayrollBatches,
  listUsers,
  updateOffice,
  updateUser,
  uploadPayrollBatch,
  savePayrollMapping,
  validatePayrollBatch,
  type PayrollBatch,
} from '../../services/worknestApi';
import {
  branchPayslipTemplates,
  computeBranchInitializationState,
  parseBranchSettings,
} from './branchInitialization';
import './branchSetup.scss';

const requiredMappingFields = [
  'employee_id',
  'employee_name',
  'gross_pay',
  'total_deductions',
  'net_pay',
] as const;

function sortBatches(batches: PayrollBatch[]) {
  return [...batches].sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

export function BranchSetupPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { officeId: officeIdParam } = useParams();
  const session = loadHrSession();
  const officeId = Number(officeIdParam);

  usePageTitle(t('pages.newDash.branchInitialization.workspaceTitle'));

  const [periodMonth, setPeriodMonth] = useState(() => new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [currentBatchId, setCurrentBatchId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const actorQuery = useQuery({
    queryKey: ['branch-setup-actor', session?.tenantId],
    queryFn: () => getCurrentActor(session!),
    enabled: Boolean(session),
  });

  const officeQuery = useQuery({
    queryKey: ['branch-setup-office', session?.tenantId, officeId],
    queryFn: () => getOffice(session!, officeId),
    enabled: Boolean(session && Number.isFinite(officeId) && officeId > 0),
  });

  const payrollBatchesQuery = useQuery({
    queryKey: ['branch-setup-batches', session?.tenantId, officeId],
    queryFn: () => listPayrollBatches(session!, { office_id: officeId }),
    enabled: Boolean(session && Number.isFinite(officeId) && officeId > 0),
  });

  const usersQuery = useQuery({
    queryKey: ['branch-setup-users', session?.tenantId],
    queryFn: () => listUsers(session!, { user_type: 'branch_admin' }),
    enabled: Boolean(session),
  });

  const actor = actorQuery.data?.actor ?? null;
  const office = officeQuery.data?.office ?? null;
  const adminFromOffice = officeQuery.data?.admin ?? null;
  const branchAdmins = usersQuery.data?.users ?? [];
  const branchAdminOptions = branchAdmins.filter((user) => user.user_type === 'branch_admin');
  const latestBatch = useMemo(
    () => sortBatches(payrollBatchesQuery.data?.batches ?? [])[0] ?? null,
    [payrollBatchesQuery.data?.batches],
  );
  const activeBatchId = currentBatchId ?? latestBatch?.id ?? null;

  const batchDetailQuery = useQuery({
    queryKey: ['branch-setup-batch-detail', session?.tenantId, activeBatchId],
    queryFn: () => getPayrollBatch(session!, activeBatchId!),
    enabled: Boolean(session && activeBatchId),
  });

  const currentOwner =
    adminFromOffice && adminFromOffice.id
      ? branchAdminOptions.find((user) => user.id === adminFromOffice.id) ?? null
      : branchAdminOptions.find((user) => user.office_id === officeId) ?? null;

  const branchState = useMemo(() => {
    if (!office) {
      return null;
    }

    return computeBranchInitializationState({
      branch: office,
      owner: currentOwner,
      latestBatch: latestBatch
        ? {
            ...latestBatch,
            validation_summary:
              batchDetailQuery.data?.batch.validation_summary ?? latestBatch.validation_summary,
          }
        : null,
    });
  }, [batchDetailQuery.data?.batch.validation_summary, currentOwner, latestBatch, office]);

  const officeSettings = useMemo(
    () => parseBranchSettings(office?.settings_json),
    [office?.settings_json],
  );

  useEffect(() => {
    const detail = batchDetailQuery.data;
    if (!detail) {
      return;
    }

    if (Object.keys(mapping).length === 0) {
      const existingMapping = detail.batch.mapping ?? {};
      if (Object.keys(existingMapping).length > 0) {
        setMapping(existingMapping);
        return;
      }

      const suggestions = detail.mapping_suggestions ?? {};
      const suggestionMapping = Object.fromEntries(
        Object.entries(suggestions).map(([field, value]) => [field, value.source]),
      );
      setMapping(suggestionMapping);
    }
  }, [batchDetailQuery.data, mapping]);

  useEffect(() => {
    if (currentOwner?.id) {
      setSelectedOwnerId(currentOwner.id);
    }
  }, [currentOwner?.id]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!session || !selectedFile) {
        throw new Error(t('pages.newDash.branchInitialization.errors.fileRequired'));
      }

      return uploadPayrollBatch(session, {
        office_id: officeId,
        period_month: periodMonth,
        period_year: periodYear,
        file: selectedFile,
      });
    },
    onSuccess: async (result) => {
      setCurrentBatchId(result.batch.id);
      setMapping(
        Object.fromEntries(
          Object.entries(result.mapping_suggestions).map(([field, value]) => [field, value.source]),
        ),
      );
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-batches', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-payroll-batches', session?.tenantId] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : t('pages.newDash.branchInitialization.errors.upload'));
    },
  });

  const mappingMutation = useMutation({
    mutationFn: async () => {
      if (!session || !activeBatchId) {
        throw new Error(t('pages.newDash.branchInitialization.errors.noBatch'));
      }

      await savePayrollMapping(session, activeBatchId, mapping);
      return validatePayrollBatch(session, activeBatchId);
    },
    onSuccess: async (result) => {
      setErrorMessage(
        result.summary.error_rows > 0
          ? t('pages.newDash.branchInitialization.errors.mappingBlocked')
          : null,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-batch-detail', session?.tenantId, activeBatchId] }),
        queryClient.invalidateQueries({ queryKey: ['branch-setup-batches', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-payroll-batches', session?.tenantId] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : t('pages.newDash.branchInitialization.errors.mapping'));
    },
  });

  const templateMutation = useMutation({
    mutationFn: async (templateKey: string) => {
      if (!session || !office) {
        throw new Error(t('pages.newDash.branchInitialization.errors.template'));
      }

      const template = branchPayslipTemplates.find((item) => item.key === templateKey);
      const mergedSettings = {
        ...parseBranchSettings(office.settings_json),
        payslip_template_key: templateKey,
        payslip_template_name: template?.name ?? templateKey,
      };

      return updateOffice(session, office.id, {
        settings_json: mergedSettings,
      });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-office', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-locations', session?.tenantId] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : t('pages.newDash.branchInitialization.errors.template'));
    },
  });

  const readyMutation = useMutation({
    mutationFn: async () => {
      if (!session || !office || !actor) {
        throw new Error(t('pages.newDash.branchInitialization.errors.ready'));
      }

      const mergedSettings = {
        ...parseBranchSettings(office.settings_json),
        branch_initialization_completed_at: new Date().toISOString(),
        branch_initialization_completed_by_user_id: actor.id,
      };

      return updateOffice(session, office.id, {
        settings_json: mergedSettings,
      });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-office', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-locations', session?.tenantId] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : t('pages.newDash.branchInitialization.errors.ready'));
    },
  });

  const assignOwnerMutation = useMutation({
    mutationFn: async () => {
      if (!session || !selectedOwnerId) {
        throw new Error(t('pages.newDash.branchInitialization.errors.owner'));
      }

      return updateUser(session, selectedOwnerId, {
        office_id: officeId,
      });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-users', session?.tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-users', session?.tenantId] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : t('pages.newDash.branchInitialization.errors.owner'));
    },
  });

  const isLoading =
    Boolean(session) &&
    (actorQuery.isLoading || officeQuery.isLoading || payrollBatchesQuery.isLoading || usersQuery.isLoading);
  const hasError = actorQuery.error || officeQuery.error || payrollBatchesQuery.error || usersQuery.error;
  const statusClassName = branchState?.status ?? 'assigned_not_started';
  const selectedTemplateKey = officeSettings.payslip_template_key ?? null;
  const headers = batchDetailQuery.data?.headers ?? [];
  const sampleRows = batchDetailQuery.data?.sample_rows ?? [];
  const latestValidationSummary = batchDetailQuery.data?.batch.validation_summary ?? latestBatch?.validation_summary;

  const toolbar = branchState
    ? (
        <p className="new-dash-page-header-note">
          {t(branchState.statusLabelKey)}
        </p>
      )
    : undefined;

  return (
    <NewPrimaryLayout
      onLogout={undefined}
      pageHeader={
        <PageHeader
          title={office?.name ?? t('pages.newDash.branchInitialization.workspaceTitle')}
          toolbar={toolbar}
        />
      }
    >
      <section className="new-dash-page">
        {!session ? (
          <div className="new-dash-panel">
            <div className="new-dash-panel-head">
              <h2>{t('pages.newDash.authRequired.title')}</h2>
            </div>
            <p className="new-dash-panel-copy">{t('pages.newDash.authRequired.description')}</p>
            <div className="new-dash-panel-actions">
              <Button as={Link} to="/login">
                {t('pages.newDash.authRequired.action')}
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="new-dash-panel">
            <div className="new-dash-panel-head">
              <h2>{t('pages.newDash.loading.title')}</h2>
            </div>
            <p className="new-dash-panel-copy">{t('common.loading')}</p>
          </div>
        ) : hasError || !office || !branchState ? (
          <div className="new-dash-panel">
            <div className="new-dash-panel-head">
              <h2>{t('pages.newDash.error.title')}</h2>
            </div>
            <p className="new-dash-panel-copy">
              {(hasError as Error | null)?.message ?? t('pages.newDash.branchInitialization.errors.noBranch')}
            </p>
          </div>
        ) : (
          <div className="new-dash-stack">
            <section className="new-dash-panel branch-setup-overview">
              <div className="new-dash-panel-head">
                <div>
                  <h2>{t('pages.newDash.branchInitialization.overview.title')}</h2>
                  <p className="new-dash-panel-copy">{t(branchState.summaryKey)}</p>
                </div>
                <span className={`new-dash-step-status ${statusClassName}`}>
                  {t(branchState.statusLabelKey)}
                </span>
              </div>

              <div className="branch-setup-overview-grid">
                <div className="branch-setup-overview-item">
                  <span>{t('pages.newDash.branchInitialization.overview.owner')}</span>
                  <strong>{currentOwner?.display_name ?? t('pages.newDash.branchInitialization.labels.unassigned')}</strong>
                </div>
                <div className="branch-setup-overview-item">
                  <span>{t('pages.newDash.branchInitialization.overview.nextAction')}</span>
                  <strong>{t(branchState.nextActionLabelKey)}</strong>
                </div>
                <div className="branch-setup-overview-item">
                  <span>{t('pages.newDash.branchInitialization.overview.lastActivity')}</span>
                  <strong>{branchState.lastActivityAt ? new Date(branchState.lastActivityAt).toLocaleDateString() : t('pages.newDash.workspace.fallback')}</strong>
                </div>
              </div>
            </section>

            {actor?.user_type === 'tenant_owner' ? (
              <section className="new-dash-panel branch-setup-owner-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.branchInitialization.ownerAssignment.title')}</h2>
                </div>
                <p className="new-dash-panel-copy">
                  {t('pages.newDash.branchInitialization.ownerAssignment.description')}
                </p>
                <div className="branch-setup-owner-actions">
                  <select
                    onChange={(event) => setSelectedOwnerId(Number(event.target.value))}
                    value={selectedOwnerId ?? ''}
                  >
                    <option value="">{t('pages.newDash.branchInitialization.ownerAssignment.placeholder')}</option>
                    {branchAdminOptions.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.display_name}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={!selectedOwnerId || assignOwnerMutation.isPending}
                    onClick={() => {
                      void assignOwnerMutation.mutateAsync();
                    }}
                    type="button"
                  >
                    {t('pages.newDash.branchInitialization.ownerAssignment.action')}
                  </Button>
                </div>
              </section>
            ) : null}

            <div className="branch-setup-step-grid">
              <section className="new-dash-panel branch-setup-step-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.branchInitialization.steps.upload.title')}</h2>
                </div>
                <p className="new-dash-panel-copy">
                  {t('pages.newDash.branchInitialization.steps.upload.description')}
                </p>
                <div className="branch-setup-upload-grid">
                  <label>
                    <span>{t('pages.newDash.branchInitialization.steps.upload.periodMonth')}</span>
                    <select onChange={(event) => setPeriodMonth(Number(event.target.value))} value={periodMonth}>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{t('pages.newDash.branchInitialization.steps.upload.periodYear')}</span>
                    <input
                      onChange={(event) => setPeriodYear(Number(event.target.value))}
                      type="number"
                      value={periodYear}
                    />
                  </label>
                  <label className="branch-setup-upload-file">
                    <span>{t('pages.newDash.branchInitialization.steps.upload.file')}</span>
                    <input
                      accept=".csv,.xlsx"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                      type="file"
                    />
                  </label>
                </div>
                <div className="new-dash-panel-actions">
                  <Button
                    disabled={!selectedFile || uploadMutation.isPending}
                    onClick={() => {
                      void uploadMutation.mutateAsync();
                    }}
                    type="button"
                  >
                    {uploadMutation.isPending
                      ? t('pages.newDash.branchInitialization.actions.uploading')
                      : t('pages.newDash.branchInitialization.actions.uploadFormat')}
                  </Button>
                </div>
              </section>

              <section className="new-dash-panel branch-setup-step-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.branchInitialization.steps.mapping.title')}</h2>
                </div>
                <p className="new-dash-panel-copy">
                  {t('pages.newDash.branchInitialization.steps.mapping.description')}
                </p>
                {headers.length > 0 ? (
                  <>
                    <div className="branch-setup-mapping-grid">
                      {requiredMappingFields.map((field) => (
                        <label key={field}>
                          <span>{t(`fieldLabels.${field}`)}</span>
                          <select
                            onChange={(event) =>
                              setMapping((current) => ({
                                ...current,
                                [field]: event.target.value,
                              }))
                            }
                            value={mapping[field] ?? ''}
                          >
                            <option value="">{t('pages.newDash.branchInitialization.steps.mapping.placeholder')}</option>
                            {headers.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    {sampleRows.length > 0 ? (
                      <div className="branch-setup-sample-table">
                        <div className="branch-setup-sample-row branch-setup-sample-row-head">
                          {headers.slice(0, 4).map((header) => (
                            <span key={header}>{header}</span>
                          ))}
                        </div>
                        {sampleRows.slice(0, 2).map((row, index) => (
                          <div className="branch-setup-sample-row" key={index}>
                            {headers.slice(0, 4).map((header) => (
                              <span key={header}>{String(row[header] ?? '—')}</span>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="new-dash-panel-actions">
                      <Button
                        disabled={
                          !activeBatchId ||
                          requiredMappingFields.some((field) => !mapping[field]) ||
                          mappingMutation.isPending
                        }
                        onClick={() => {
                          void mappingMutation.mutateAsync();
                        }}
                        type="button"
                      >
                        {mappingMutation.isPending
                          ? t('pages.newDash.branchInitialization.actions.confirmingHeaders')
                          : t('pages.newDash.branchInitialization.actions.confirmHeaders')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="new-dash-panel-note">
                    {t('pages.newDash.branchInitialization.steps.mapping.empty')}
                  </p>
                )}
                {latestValidationSummary?.error_rows ? (
                  <p className="branch-setup-inline-warning">
                    {t('pages.newDash.branchInitialization.steps.mapping.errorSummary', {
                      count: latestValidationSummary.error_rows,
                    })}
                  </p>
                ) : null}
              </section>
            </div>

            <div className="branch-setup-step-grid">
              <section className="new-dash-panel branch-setup-step-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.branchInitialization.steps.template.title')}</h2>
                </div>
                <p className="new-dash-panel-copy">
                  {t('pages.newDash.branchInitialization.steps.template.description')}
                </p>
                <div className="branch-setup-template-grid">
                  {branchPayslipTemplates.map((template) => (
                    <button
                      className={
                        selectedTemplateKey === template.key
                          ? 'branch-setup-template-card is-selected'
                          : 'branch-setup-template-card'
                      }
                      key={template.key}
                      onClick={() => {
                        void templateMutation.mutateAsync(template.key);
                      }}
                      type="button"
                    >
                      <strong>{template.name}</strong>
                      <p>{template.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="new-dash-panel branch-setup-step-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.branchInitialization.steps.ready.title')}</h2>
                </div>
                <p className="new-dash-panel-copy">
                  {t('pages.newDash.branchInitialization.steps.ready.description')}
                </p>
                <div className="branch-setup-ready-checklist">
                  <div className={branchState.hasUploadedFormat ? 'branch-setup-ready-item is-complete' : 'branch-setup-ready-item'}>
                    {t('pages.newDash.branchInitialization.steps.ready.uploaded')}
                  </div>
                  <div className={branchState.hasConfirmedHeaders ? 'branch-setup-ready-item is-complete' : 'branch-setup-ready-item'}>
                    {t('pages.newDash.branchInitialization.steps.ready.headers')}
                  </div>
                  <div className={branchState.hasTemplate ? 'branch-setup-ready-item is-complete' : 'branch-setup-ready-item'}>
                    {t('pages.newDash.branchInitialization.steps.ready.template')}
                  </div>
                </div>
                <div className="new-dash-panel-actions">
                  <Button
                    disabled={
                      !branchState.hasUploadedFormat ||
                      !branchState.hasConfirmedHeaders ||
                      !branchState.hasTemplate ||
                      readyMutation.isPending
                    }
                    onClick={() => {
                      void readyMutation.mutateAsync();
                    }}
                    type="button"
                  >
                    {readyMutation.isPending
                      ? t('pages.newDash.branchInitialization.actions.markingReady')
                      : t('pages.newDash.branchInitialization.actions.markReady')}
                  </Button>
                  {branchState.isReadyMarked ? (
                    <Button as={Link} to="/new-dash" variant="secondary">
                      {t('pages.newDash.branchInitialization.actions.openBranch')}
                    </Button>
                  ) : null}
                </div>
              </section>
            </div>

            {errorMessage ? <p className="branch-setup-error">{errorMessage}</p> : null}
          </div>
        )}
      </section>
    </NewPrimaryLayout>
  );
}
