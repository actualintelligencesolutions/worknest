import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { PageHeader } from '../../components/organisms/PageHeader';
import { usePageTitle } from '../../hooks/usePageTitle';
import { NewPrimaryLayout } from '../../layouts/NewPrimary';
import setupIllustration from '../../assets/images/Setup.png';
import { ApiRequestError } from '../../services/apiClient';
import { loadHrSession } from '../../services/hrSession';
import {
  buildSitePortalUrl,
  buildTenantLoginUrl,
  getCurrentActor,
  getOffice,
  listPayrollBatches,
  listUsers,
  resetEmployeePin,
  resetOfficeEmployeePins,
  updateOffice,
  updateUser,
  uploadPayrollBatch,
  type PayrollBatch,
  type UserSummary,
} from '../../services/worknestApi';
import {
  branchPayslipTemplates,
  computeBranchInitializationState,
  parseBranchSettings,
  type BranchInitializationState,
} from './branchInitialization';
import './setup.scss';
import './branchSetup.scss';

type BranchWizardStep = 'owner' | 'upload' | 'review' | 'template' | 'ready' | 'complete';

function sortBatches(batches: PayrollBatch[]) {
  return [...batches].sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

function formatShortDate(value: string | null) {
  if (!value) {
    return 'No recent activity';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatPayrollUploadError(error: unknown) {
  if (error instanceof ApiRequestError && error.code === 'VALIDATION_ERROR') {
    const missingFields = Array.isArray(error.details?.missing_fields)
      ? error.details.missing_fields.filter((value): value is string => typeof value === 'string')
      : [];

    if (missingFields.length > 0) {
      return `${error.message} Missing: ${missingFields.join(', ')}.`;
    }
  }

  return error instanceof Error ? error.message : 'We could not process this payroll upload.';
}

function deriveWizardStep(branchState: BranchInitializationState, isTenantOwner: boolean) {
  if (branchState.isReadyMarked) {
    return 'complete';
  }

  if (!branchState.owner && isTenantOwner) {
    return 'owner';
  }

  if (!branchState.latestBatch) {
    return 'upload';
  }

  if (branchState.isBlocked) {
    return 'review';
  }

  if (!branchState.hasTemplate) {
    return 'template';
  }

  return 'ready';
}

function visibleWizardSteps(branchState: BranchInitializationState, isTenantOwner: boolean) {
  const steps: BranchWizardStep[] = [];

  if (!branchState.owner && isTenantOwner) {
    steps.push('owner');
  }

  steps.push('upload', 'review', 'template', 'ready');

  if (branchState.isReadyMarked) {
    steps.push('complete');
  }

  return steps;
}

export function BranchSetupPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { officeId: officeIdParam } = useParams();
  const session = loadHrSession();
  const officeId = Number(officeIdParam);

  usePageTitle(t('pages.newDash.branchInitialization.workspaceTitle'));

  const [periodMonth, setPeriodMonth] = useState(() => new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUploadStoredCount, setLastUploadStoredCount] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<BranchWizardStep | null>(null);
  const [showConfiguredSettings, setShowConfiguredSettings] = useState(false);
  const [urlFeedback, setUrlFeedback] = useState<string | null>(null);
  const [revealedPins, setRevealedPins] = useState<Record<number, string>>({});
  const [customPins, setCustomPins] = useState<Record<number, string>>({});
  const [bulkRevealedPins, setBulkRevealedPins] = useState<Array<{
    user_id: number;
    employee_id: string | null;
    display_name: string;
    email?: string | null;
    phone?: string | null;
    revealed_pin: string;
  }>>([]);

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

  const employeeUsersQuery = useQuery({
    queryKey: ['branch-setup-employees', session?.tenantId, officeId],
    queryFn: () => listUsers(session!, { office_id: officeId, user_type: 'employee' }),
    enabled: Boolean(session && Number.isFinite(officeId) && officeId > 0),
  });

  const actor = actorQuery.data?.actor ?? null;
  const office = officeQuery.data?.office ?? null;
  const adminFromOffice = officeQuery.data?.admin ?? null;
  const branchAdmins = usersQuery.data?.users ?? [];
  const branchEmployees = employeeUsersQuery.data?.users ?? [];
  const branchAdminOptions = branchAdmins.filter((user) => user.user_type === 'branch_admin');
  const latestBatch = useMemo(
    () => sortBatches(payrollBatchesQuery.data?.batches ?? [])[0] ?? null,
    [payrollBatchesQuery.data?.batches],
  );

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
      latestBatch,
    });
  }, [currentOwner, latestBatch, office]);

  const officeSettings = useMemo(
    () => parseBranchSettings(office?.settings_json),
    [office?.settings_json],
  );

  const isTenantOwner = actor?.user_type === 'tenant_owner';
  const isConfigured = branchState?.status === 'initialized' || showConfiguredSettings;
  const latestValidationSummary = latestBatch?.validation_summary;
  const latestStoredCount = latestValidationSummary?.valid_rows ?? lastUploadStoredCount ?? 0;
  const latestErrorCount = latestValidationSummary?.error_rows ?? 0;
  const selectedTemplateKey = officeSettings.payslip_template_key ?? null;
  const wizardTemplateOptions = branchPayslipTemplates.slice(0, 1);
  const adminLoginUrl = office ? buildTenantLoginUrl(office.tenant_id) : '';
  const sitePortalUrl = office?.office_code ? buildSitePortalUrl(office.tenant_id, office.office_code) : '';
  const showEmployeePinSettings = isConfigured && office?.office_type === 'branch';

  const wizardSteps = useMemo(
    () => (branchState ? visibleWizardSteps(branchState, isTenantOwner) : []),
    [branchState, isTenantOwner],
  );

  const derivedStep = useMemo(
    () => (branchState ? deriveWizardStep(branchState, isTenantOwner) : null),
    [branchState, isTenantOwner],
  );

  useEffect(() => {
    if (currentOwner?.id) {
      setSelectedOwnerId(currentOwner.id);
    }
  }, [currentOwner?.id]);

  useEffect(() => {
    if (!branchState || isConfigured || !derivedStep) {
      setCurrentStep(null);
      return;
    }

    setCurrentStep((existing) => {
      if (!existing) {
        return derivedStep;
      }

      if (branchState.isBlocked) {
        return 'review';
      }

      if (existing === 'owner' && branchState.owner) {
        return 'upload';
      }

      if (existing === 'upload' && branchState.latestBatch) {
        return branchState.isBlocked ? 'review' : 'review';
      }

      if (existing === 'template' && branchState.hasTemplate) {
        return 'ready';
      }

      if (existing === 'ready' && branchState.isReadyMarked) {
        return 'complete';
      }

      if (!wizardSteps.includes(existing)) {
        return derivedStep;
      }

      return existing;
    });
  }, [branchState, derivedStep, isConfigured, wizardSteps]);

  useEffect(() => {
    if (!branchState?.isReadyMarked) {
      setShowConfiguredSettings(false);
    }
  }, [branchState?.isReadyMarked]);

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
      setErrorMessage(null);
      setLastUploadStoredCount(result.records_created);
      setSelectedFile(null);
      setCurrentStep('review');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-batches', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-payroll-batches', session?.tenantId] }),
      ]);
    },
    onError: async (error) => {
      setLastUploadStoredCount(null);
      setErrorMessage(formatPayrollUploadError(error) ?? t('pages.newDash.branchInitialization.errors.upload'));
      setCurrentStep('review');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-batches', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-payroll-batches', session?.tenantId] }),
      ]);
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
      if (!isConfigured) {
        setCurrentStep('ready');
      }
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
      setCurrentStep('complete');
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
      setCurrentStep('upload');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-users', session?.tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-users', session?.tenantId] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : t('pages.newDash.branchInitialization.errors.owner'));
    },
  });

  const employeePinMutation = useMutation({
    mutationFn: async ({ user, pin }: { user: UserSummary; pin?: string }) => {
      if (!session) {
        throw new Error('You must be signed in to manage employee PINs.');
      }

      return resetEmployeePin(session, user.id, pin ? { pin } : {});
    },
    onSuccess: async (result, variables) => {
      setErrorMessage(null);
      setBulkRevealedPins([]);
      setRevealedPins((current) => ({
        ...current,
        [variables.user.id]: result.revealed_pin,
      }));
      setCustomPins((current) => ({
        ...current,
        [variables.user.id]: '',
      }));
      await queryClient.invalidateQueries({ queryKey: ['branch-setup-employees', session?.tenantId, officeId] });
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'We could not update the employee PIN.');
    },
  });

  const bulkEmployeePinMutation = useMutation({
    mutationFn: async () => {
      if (!session) {
        throw new Error('You must be signed in to manage employee PINs.');
      }

      return resetOfficeEmployeePins(session, officeId);
    },
    onSuccess: async (result) => {
      setErrorMessage(null);
      setRevealedPins({});
      setCustomPins({});
      setBulkRevealedPins(result.employees);
      await queryClient.invalidateQueries({ queryKey: ['branch-setup-employees', session?.tenantId, officeId] });
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'We could not reset the employee PINs.');
    },
  });

  const isLoading =
    Boolean(session) &&
    (actorQuery.isLoading || officeQuery.isLoading || payrollBatchesQuery.isLoading || usersQuery.isLoading);
  const hasError = actorQuery.error || officeQuery.error || payrollBatchesQuery.error || usersQuery.error;
  const statusClassName = branchState?.status ?? 'assigned_not_started';

  function wizardTitle(step: BranchWizardStep) {
    switch (step) {
      case 'owner':
        return t('pages.newDash.branchInitialization.ownerAssignment.title');
      case 'upload':
        return t('pages.newDash.branchInitialization.steps.upload.title');
      case 'review':
        return t('pages.newDash.branchInitialization.steps.mapping.title');
      case 'template':
        return t('pages.newDash.branchInitialization.steps.template.title');
      case 'ready':
        return t('pages.newDash.branchInitialization.steps.ready.title');
      case 'complete':
        return 'Branch setup complete';
    }
  }

  function wizardDescription(step: BranchWizardStep) {
    switch (step) {
      case 'owner':
        return t('pages.newDash.branchInitialization.ownerAssignment.description');
      case 'upload':
        return t('pages.newDash.branchInitialization.steps.upload.description');
      case 'review':
        return t('pages.newDash.branchInitialization.steps.mapping.description');
      case 'template':
        return t('pages.newDash.branchInitialization.steps.template.description');
      case 'ready':
        return t('pages.newDash.branchInitialization.steps.ready.description');
      case 'complete':
        return 'This branch is configured and ready to move into day-to-day operations.';
    }
  }

  function canContinue(step: BranchWizardStep) {
    if (!branchState) {
      return false;
    }

    switch (step) {
      case 'owner':
        return Boolean(selectedOwnerId) && !assignOwnerMutation.isPending;
      case 'upload':
        return Boolean(selectedFile) && !uploadMutation.isPending;
      case 'review':
        return branchState.hasUploadedFormat && !branchState.isBlocked;
      case 'template':
        return Boolean(selectedTemplateKey) && !templateMutation.isPending;
      case 'ready':
        return branchState.hasUploadedFormat && !branchState.isBlocked && branchState.hasTemplate && !readyMutation.isPending;
      case 'complete':
        return true;
    }
  }

  function handleWizardBack() {
    if (!currentStep) {
      return;
    }

    const stepIndex = wizardSteps.indexOf(currentStep);
    const previousStep = stepIndex > 0 ? wizardSteps[stepIndex - 1] : null;
    if (previousStep) {
      setErrorMessage(null);
      setCurrentStep(previousStep);
    }
  }

  function handleWizardContinue() {
    if (!branchState || !currentStep) {
      return;
    }

    setErrorMessage(null);

    if (currentStep === 'owner') {
      void assignOwnerMutation.mutateAsync();
      return;
    }

    if (currentStep === 'upload') {
      void uploadMutation.mutateAsync();
      return;
    }

    if (currentStep === 'review') {
      setCurrentStep('template');
      return;
    }

    if (currentStep === 'template') {
      setCurrentStep('ready');
      return;
    }

    if (currentStep === 'ready') {
      void readyMutation.mutateAsync();
      return;
    }
  }

  function renderWizardBody(step: BranchWizardStep) {
    if (!branchState) {
      return null;
    }

    if (step === 'owner') {
      return (
        <div className="new-dash-setup-form-grid">
          <label className="new-dash-setup-form-full">
            <span>{t('pages.newDash.branchInitialization.ownerAssignment.placeholder')}</span>
            <select
              className="branch-setup-wizard-select"
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
          </label>
        </div>
      );
    }

    if (step === 'upload') {
      return (
        <div className="new-dash-setup-form-grid">
          <label>
            <span>{t('pages.newDash.branchInitialization.steps.upload.periodMonth')}</span>
            <select
              className="branch-setup-wizard-select"
              onChange={(event) => setPeriodMonth(Number(event.target.value))}
              value={periodMonth}
            >
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

          <label className="new-dash-setup-form-full">
            <span>{t('pages.newDash.branchInitialization.steps.upload.file')}</span>
            <input
              className="branch-setup-wizard-file"
              accept=".csv,.xlsx"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
        </div>
      );
    }

    if (step === 'review') {
      return (
        <div className="branch-setup-wizard-review">
          <div className="branch-setup-import-summary">
            <div className="branch-setup-import-summary-item">
              <span>Latest batch</span>
              <strong>{latestBatch?.source_file_name ?? 'Awaiting upload'}</strong>
            </div>
            <div className="branch-setup-import-summary-item">
              <span>Records stored</span>
              <strong>{latestStoredCount}</strong>
            </div>
            <div className="branch-setup-import-summary-item">
              <span>Issues found</span>
              <strong>{latestErrorCount}</strong>
            </div>
          </div>
          {latestBatch?.upload_status === 'processed' ? (
            <p className="branch-setup-inline-success">
              Worknest accepted this paysheet and stored {latestStoredCount} payroll record{latestStoredCount === 1 ? '' : 's'} for this branch.
            </p>
          ) : null}
          {branchState.isBlocked ? (
            <p className="branch-setup-inline-warning">
              {latestValidationSummary?.critical_errors?.[0] ??
                'This upload needs attention before the branch can move forward.'}
            </p>
          ) : null}
        </div>
      );
    }

    if (step === 'template') {
      return (
        <div className="branch-setup-template-wizard-stack" role="radiogroup" aria-label="Payslip template">
          {wizardTemplateOptions.map((template) => {
            const isSelected = selectedTemplateKey === template.key;

            return (
              <label
                className={
                  isSelected
                    ? 'branch-setup-template-wizard-option is-selected'
                    : 'branch-setup-template-wizard-option'
                }
                key={template.key}
              >
                <input
                  checked={isSelected}
                  name="branch-template-choice"
                  onChange={() => {
                    setErrorMessage(null);
                    void templateMutation.mutateAsync(template.key);
                  }}
                  type="radio"
                  value={template.key}
                />
                <div className="branch-setup-template-wizard-copy">
                  <strong>{template.name}</strong>
                  <p>{template.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      );
    }

    if (step === 'ready') {
      return (
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
      );
    }

    return (
      <div className="new-dash-setup-complete">
        <div className="new-dash-setup-complete-badge">Branch ready</div>
        <h3>{office?.name ?? 'Branch setup complete'}</h3>
        <p>This branch has completed setup and can now move into ongoing payroll configuration and day-to-day management.</p>
        <div className="new-dash-setup-summary">
          <div>
            <span>Site owner</span>
            <strong>{currentOwner?.display_name ?? t('pages.newDash.branchInitialization.labels.unassigned')}</strong>
          </div>
          <div>
            <span>Payslip template</span>
            <strong>{officeSettings.payslip_template_name ?? 'Not selected'}</strong>
          </div>
          <div>
            <span>Latest upload</span>
            <strong>{latestBatch?.source_file_name ?? 'No upload yet'}</strong>
          </div>
        </div>
      </div>
    );
  }

  function renderWizard() {
    if (!branchState || !currentStep) {
      return null;
    }

    const currentStepIndex = Math.max(wizardSteps.indexOf(currentStep), 0);
    const progressSteps = wizardSteps.filter((step) => step !== 'complete');
    const progressTotal = Math.max(progressSteps.length, 1);
    const progressCurrent = Math.min(currentStepIndex + 1, progressTotal);
    const canGoBack = currentStepIndex > 0 && currentStep !== 'complete';

    return (
      <NewPrimaryLayout onLogout={undefined} headerVariant="quiet">
        <section className="new-dash-setup-shell branch-setup-wizard-shell">
          <div className="new-dash-setup-card branch-setup-wizard-card">
            <div className="new-dash-setup-visual branch-setup-wizard-visual">
              <div className="new-dash-setup-progress">
                <span>{`Branch setup ${progressCurrent}/${progressTotal}`}</span>
                <div className="new-dash-setup-progress-dots" aria-hidden="true">
                  {progressSteps.map((step, index) => (
                    <span
                      className={
                        index <= currentStepIndex
                          ? 'new-dash-setup-progress-dot is-active'
                          : 'new-dash-setup-progress-dot'
                      }
                      key={step}
                    />
                  ))}
                </div>
              </div>

              <div className="new-dash-setup-visual-copy">
                <p className="new-dash-setup-kicker">{t(branchState.statusLabelKey)}</p>
                <h1>{office?.name ?? t('pages.newDash.branchInitialization.workspaceTitle')}</h1>
                <p>{t(branchState.summaryKey)}</p>
              </div>

              <div className="branch-setup-wizard-context">
                <div>
                  <span>Owner</span>
                  <strong>{currentOwner?.display_name ?? t('pages.newDash.branchInitialization.labels.unassigned')}</strong>
                </div>
                <div>
                  <span>Latest activity</span>
                  <strong>{formatShortDate(branchState.lastActivityAt)}</strong>
                </div>
                <div>
                  <span>Next action</span>
                  <strong>{t(branchState.nextActionLabelKey)}</strong>
                </div>
              </div>

              <div className="branch-setup-wizard-illustration" aria-hidden="true">
                <img alt="" className="branch-setup-wizard-illustration-image" src={setupIllustration} />
              </div>
            </div>

            <div className="new-dash-setup-content">
              <div className="new-dash-setup-step-head">
                <h2>{wizardTitle(currentStep)}</h2>
                <p className="new-dash-setup-copy">{wizardDescription(currentStep)}</p>
              </div>

              {renderWizardBody(currentStep)}

              {errorMessage ? <p className="new-dash-setup-error">{errorMessage}</p> : null}

              <div className="new-dash-setup-actions">
                {currentStep === 'complete' ? (
                  <Button
                    onClick={() => {
                      setShowConfiguredSettings(true);
                    }}
                    type="button"
                  >
                    Open branch settings
                  </Button>
                ) : (
                  <>
                    <button
                      className="new-dash-setup-back"
                      disabled={!canGoBack}
                      onClick={handleWizardBack}
                      type="button"
                    >
                      Back
                    </button>
                    <Button
                      disabled={!canContinue(currentStep)}
                      onClick={handleWizardContinue}
                      type="button"
                    >
                      {currentStep === 'ready'
                        ? readyMutation.isPending
                          ? t('pages.newDash.branchInitialization.actions.markingReady')
                          : t('pages.newDash.branchInitialization.actions.markReady')
                        : currentStep === 'upload'
                          ? uploadMutation.isPending
                            ? t('pages.newDash.branchInitialization.actions.uploading')
                            : 'Continue'
                          : 'Continue'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </NewPrimaryLayout>
    );
  }

  function renderConfiguredSettings() {
    const toolbar = branchState
      ? <p className="new-dash-page-header-note">General branch settings</p>
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
          <div className="new-dash-stack">
            <section className="new-dash-panel branch-settings-hero">
              <div className="new-dash-panel-head">
                <div>
                  <h2>Branch configuration</h2>
                  <p className="new-dash-panel-copy">
                    This branch is already initialized. Update the operational settings below when ownership, template, or payroll uploads change.
                  </p>
                </div>
                <span className={`new-dash-step-status ${statusClassName}`}>
                  {t(branchState?.statusLabelKey ?? '')}
                </span>
              </div>

              <div className="branch-setup-overview-grid">
                <div className="branch-setup-overview-item">
                  <span>Site owner</span>
                  <strong>{currentOwner?.display_name ?? t('pages.newDash.branchInitialization.labels.unassigned')}</strong>
                </div>
                <div className="branch-setup-overview-item">
                  <span>Latest upload</span>
                  <strong>{latestBatch?.source_file_name ?? 'No upload yet'}</strong>
                </div>
                <div className="branch-setup-overview-item">
                  <span>Last activity</span>
                  <strong>{formatShortDate(branchState?.lastActivityAt ?? null)}</strong>
                </div>
              </div>
            </section>

            <section className="new-dash-panel branch-setup-links-panel">
              <div className="new-dash-panel-head">
                <h2>Shareable access links</h2>
              </div>
              <p className="new-dash-panel-copy">Use these direct URLs so admins and employees land in the right workspace or site without typing the company slug.</p>
              <div className="branch-setup-link-grid">
                <label className="branch-setup-link-field">
                  <span>Company admin login</span>
                  <input readOnly type="text" value={adminLoginUrl} />
                </label>
                <label className="branch-setup-link-field">
                  <span>Site employee portal</span>
                  <input readOnly type="text" value={sitePortalUrl} />
                </label>
              </div>
              <div className="new-dash-panel-actions">
                <Button
                  onClick={() => {
                    void navigator.clipboard.writeText(adminLoginUrl);
                    setUrlFeedback('Company login URL copied.');
                  }}
                  type="button"
                  variant="secondary"
                >
                  Copy company login URL
                </Button>
                <Button
                  disabled={sitePortalUrl === ''}
                  onClick={() => {
                    if (!sitePortalUrl) {
                      return;
                    }
                    void navigator.clipboard.writeText(sitePortalUrl);
                    setUrlFeedback('Site employee portal URL copied.');
                  }}
                  type="button"
                >
                  Copy site portal URL
                </Button>
              </div>
              {urlFeedback ? <p className="new-dash-panel-note">{urlFeedback}</p> : null}
            </section>

            {isTenantOwner ? (
              <section className="new-dash-panel branch-setup-owner-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.branchInitialization.ownerAssignment.title')}</h2>
                </div>
                <p className="new-dash-panel-copy">Change who owns this branch configuration and payroll coordination.</p>
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
                    {t('pages.newDash.branchInitialization.actions.assignOwner')}
                  </Button>
                </div>
              </section>
            ) : null}

            <div className="branch-setup-step-grid">
              <section className="new-dash-panel branch-setup-step-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.branchInitialization.steps.template.title')}</h2>
                </div>
                <p className="new-dash-panel-copy">Switch the default payslip presentation this branch should use going forward.</p>
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
                  <h2>Latest payroll upload</h2>
                </div>
                <p className="new-dash-panel-copy">Monitor the most recent import status and upload a fresh paysheet when branch payroll changes.</p>
                {latestBatch ? (
                  <>
                    <div className="branch-setup-import-summary">
                      <div className="branch-setup-import-summary-item">
                        <span>Latest batch</span>
                        <strong>{latestBatch.source_file_name}</strong>
                      </div>
                      <div className="branch-setup-import-summary-item">
                        <span>Records stored</span>
                        <strong>{latestStoredCount}</strong>
                      </div>
                      <div className="branch-setup-import-summary-item">
                        <span>Issues found</span>
                        <strong>{latestErrorCount}</strong>
                      </div>
                    </div>
                    {latestBatch.upload_status === 'processed' ? (
                      <p className="branch-setup-inline-success">
                        This branch upload is healthy and ready for downstream payroll publishing.
                      </p>
                    ) : latestErrorCount > 0 ? (
                      <p className="branch-setup-inline-warning">
                        {latestValidationSummary?.critical_errors?.[0] ?? 'The latest upload needs attention.'}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="new-dash-panel-note">No payroll upload has been stored for this branch yet.</p>
                )}
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
            </div>

            {showEmployeePinSettings ? (
              <section className="new-dash-panel branch-setup-step-panel branch-setup-pin-panel">
                <div className="new-dash-panel-head">
                  <h2>Employee PIN access</h2>
                </div>
                <p className="new-dash-panel-copy">Assign, reset, reveal, and share employee login PINs for this branch. Revealed PINs are shown only right after you set or regenerate them.</p>

                <div className="branch-setup-pin-toolbar">
                  <Button
                    disabled={branchEmployees.length === 0 || bulkEmployeePinMutation.isPending}
                    onClick={() => {
                      if (!window.confirm('Reset PINs for every employee in this branch? Existing PINs will stop working immediately.')) {
                        return;
                      }
                      void bulkEmployeePinMutation.mutateAsync();
                    }}
                    type="button"
                  >
                    {bulkEmployeePinMutation.isPending ? 'Resetting all PINs...' : 'Reset all employee PINs'}
                  </Button>
                  <Button
                    disabled={bulkRevealedPins.length === 0}
                    onClick={() => {
                      const text = bulkRevealedPins
                        .map((employee) => `${employee.display_name} (${employee.employee_id ?? 'No ID'}): ${employee.revealed_pin}`)
                        .join('\n');
                      void navigator.clipboard.writeText(text);
                      setUrlFeedback('All regenerated employee PINs copied.');
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Copy all revealed PINs
                  </Button>
                </div>

                {bulkRevealedPins.length > 0 ? (
                  <div className="branch-setup-pin-bulk-results">
                    {bulkRevealedPins.map((employee) => (
                      <div className="branch-setup-pin-bulk-item" key={employee.user_id}>
                        <strong>{employee.display_name}</strong>
                        <span>{employee.employee_id ?? 'No employee ID'}</span>
                        <code>{employee.revealed_pin}</code>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="branch-setup-pin-list">
                  {branchEmployees.length === 0 ? (
                    <p className="new-dash-panel-note">No employees are assigned to this branch yet.</p>
                  ) : (
                    branchEmployees.map((employee) => {
                      const loginContact = employee.email || employee.phone || 'No login contact';
                      const revealedPin = revealedPins[employee.id] ?? null;
                      const customPin = customPins[employee.id] ?? '';

                      return (
                        <article className="branch-setup-pin-card" key={employee.id}>
                          <div className="branch-setup-pin-card-head">
                            <div>
                              <h3>{employee.display_name}</h3>
                              <p>{employee.employee_id ?? 'No employee ID'} · {loginContact}</p>
                            </div>
                            <span className={employee.has_pin ? 'branch-setup-pin-status is-set' : 'branch-setup-pin-status'}>
                              {employee.has_pin ? 'Set' : 'Not set'}
                            </span>
                          </div>

                          <div className="branch-setup-pin-actions">
                            <label className="branch-setup-pin-input">
                              <span>Custom PIN</span>
                              <input
                                inputMode="numeric"
                                maxLength={8}
                                onChange={(event) => {
                                  setCustomPins((current) => ({
                                    ...current,
                                    [employee.id]: event.target.value.replace(/\D+/g, ''),
                                  }));
                                }}
                                placeholder="4 to 8 digits"
                                type="text"
                                value={customPin}
                              />
                            </label>

                            <div className="branch-setup-pin-button-row">
                              <Button
                                disabled={employeePinMutation.isPending}
                                onClick={() => {
                                  void employeePinMutation.mutateAsync({
                                    user: employee,
                                    pin: customPin.trim() !== '' ? customPin.trim() : undefined,
                                  });
                                }}
                                type="button"
                              >
                                {customPin.trim() !== '' ? 'Assign custom PIN' : 'Generate PIN'}
                              </Button>
                              <Button
                                disabled={!revealedPin}
                                onClick={() => {
                                  if (!revealedPin) {
                                    return;
                                  }
                                  void navigator.clipboard.writeText(revealedPin);
                                  setUrlFeedback(`PIN copied for ${employee.display_name}.`);
                                }}
                                type="button"
                                variant="secondary"
                              >
                                Copy revealed PIN
                              </Button>
                            </div>
                          </div>

                          {revealedPin ? (
                            <div className="branch-setup-pin-reveal">
                              <span>Fresh PIN</span>
                              <code>{revealedPin}</code>
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            ) : null}

            {errorMessage ? <p className="branch-setup-error">{errorMessage}</p> : null}
          </div>
        </section>
      </NewPrimaryLayout>
    );
  }

  if (!session) {
    return (
      <NewPrimaryLayout onLogout={undefined}>
        <section className="new-dash-page">
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
        </section>
      </NewPrimaryLayout>
    );
  }

  if (isLoading) {
    return (
      <NewPrimaryLayout onLogout={undefined}>
        <section className="new-dash-page">
          <div className="new-dash-panel">
            <div className="new-dash-panel-head">
              <h2>{t('pages.newDash.loading.title')}</h2>
            </div>
            <p className="new-dash-panel-copy">{t('common.loading')}</p>
          </div>
        </section>
      </NewPrimaryLayout>
    );
  }

  if (hasError || !office || !branchState) {
    return (
      <NewPrimaryLayout onLogout={undefined}>
        <section className="new-dash-page">
          <div className="new-dash-panel">
            <div className="new-dash-panel-head">
              <h2>{t('pages.newDash.error.title')}</h2>
            </div>
            <p className="new-dash-panel-copy">
              {(hasError as Error | null)?.message ?? t('pages.newDash.branchInitialization.errors.noBranch')}
            </p>
          </div>
        </section>
      </NewPrimaryLayout>
    );
  }

  return isConfigured ? renderConfiguredSettings() : renderWizard();
}
