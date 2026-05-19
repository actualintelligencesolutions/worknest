import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { PageHeader } from '../../components/organisms/PageHeader';
import { newHeaderSiteOwnerNavItems } from '../../config/newHeader';
import { usePageTitle } from '../../hooks/usePageTitle';
import { NewPrimaryLayout } from '../../layouts/NewPrimary';
import setupIllustration from '../../assets/images/Setup.png';
import { ApiRequestError } from '../../services/apiClient';
import { loadHrSession } from '../../services/hrSession';
import {
  cancelSiteOwnerInvite,
  buildSitePortalUrl,
  buildTenantLoginUrl,
  getCurrentActor,
  getOffice,
  inviteSiteOwner,
  importMissingEmployeesForPayrollBatch,
  listPayrollBatches,
  listUsers,
  resetEmployeePin,
  resetOfficeEmployeePins,
  resendSiteOwnerInvite,
  updateOffice,
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
type BranchSettingsSection = 'overview' | 'payroll' | 'employees' | 'pins' | 'access';

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
    const summary = error.details?.summary;
    const criticalErrors =
      summary && typeof summary === 'object' && Array.isArray((summary as { critical_errors?: unknown[] }).critical_errors)
        ? (summary as { critical_errors?: unknown[] }).critical_errors.filter(
            (value): value is string => typeof value === 'string' && value.trim() !== '',
          )
        : [];

    if (missingFields.length > 0) {
      return `${error.message} Missing: ${missingFields.join(', ')}.`;
    }

    if (criticalErrors.length > 0) {
      return criticalErrors[0];
    }
  }

  return error instanceof Error ? error.message : 'We could not process this payroll upload.';
}

function missingEmployeeIds(summary?: PayrollBatch['validation_summary'] | null) {
  return missingEmployeeIdsFromCriticalErrors(summary?.critical_errors ?? []);
}

function missingEmployeeIdsFromCriticalErrors(criticalErrors: string[] = []) {
  const ids = new Set<string>();

  for (const error of criticalErrors) {
    const match = typeof error === 'string'
      ? error.match(/^Employee\s+(.+?)\s+is not in Worknest yet\./)
      : null;

    if (match?.[1]) {
      ids.add(match[1]);
    }
  }

  return [...ids];
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

function branchSettingsSectionFromPath(pathname: string, officeId: number): BranchSettingsSection {
  const basePath = `/new-dash/branches/${officeId}`;

  if (pathname === `${basePath}/payroll`) {
    return 'payroll';
  }
  if (pathname === `${basePath}/employees`) {
    return 'employees';
  }
  if (pathname === `${basePath}/pins`) {
    return 'pins';
  }
  if (pathname === `${basePath}/access`) {
    return 'access';
  }

  return 'overview';
}

function branchPendingItems(branchState: BranchInitializationState, ownerLabel: string) {
  const items = [
    {
      key: 'owner',
      label: 'Site owner assigned',
      complete: Boolean(branchState.owner),
      detail: branchState.owner?.display_name ?? ownerLabel,
    },
    {
      key: 'payroll',
      label: 'Payroll upload accepted',
      complete: branchState.hasConfirmedHeaders && !branchState.isBlocked,
      detail: branchState.latestBatch?.source_file_name ?? 'No accepted upload yet',
    },
    {
      key: 'template',
      label: 'Payslip template selected',
      complete: branchState.hasTemplate,
      detail: branchState.settings.payslip_template_name ?? 'Template not selected',
    },
    {
      key: 'ready',
      label: 'Branch marked ready',
      complete: branchState.isReadyMarked,
      detail: branchState.isReadyMarked ? 'Ready for operations' : 'Ready mark still pending',
    },
  ];

  return items;
}

export function BranchSetupPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { officeId: officeIdParam } = useParams();
  const session = loadHrSession();
  const officeId = Number(officeIdParam);

  usePageTitle(t('pages.newDash.branchInitialization.workspaceTitle'));

  const [periodMonth, setPeriodMonth] = useState(() => new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ownerInviteEmail, setOwnerInviteEmail] = useState('');
  const [ownerInviteName, setOwnerInviteName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importEmployeesMessage, setImportEmployeesMessage] = useState<string | null>(null);
  const [lastUploadStoredCount, setLastUploadStoredCount] = useState<number | null>(null);
  const [missingEmployeePromptIds, setMissingEmployeePromptIds] = useState<string[]>([]);
  const [missingEmployeePromptOpen, setMissingEmployeePromptOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<BranchWizardStep | null>(null);
  const [forceConfiguredShell, setForceConfiguredShell] = useState(false);
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

  const employeeUsersQuery = useQuery({
    queryKey: ['branch-setup-employees', session?.tenantId, officeId],
    queryFn: () => listUsers(session!, { office_id: officeId, user_type: 'employee' }),
    enabled: Boolean(session && Number.isFinite(officeId) && officeId > 0),
  });

  const actor = actorQuery.data?.actor ?? null;
  const office = officeQuery.data?.office ?? null;
  const adminFromOffice = officeQuery.data?.admin ?? null;
  const siteOwnerFromOffice = officeQuery.data?.site_owner ?? null;
  const pendingSiteOwnerInvite = officeQuery.data?.pending_site_owner_invite ?? null;
  const branchEmployees = employeeUsersQuery.data?.users ?? [];
  const latestBatch = useMemo(
    () => sortBatches(payrollBatchesQuery.data?.batches ?? [])[0] ?? null,
    [payrollBatchesQuery.data?.batches],
  );

  const currentOwner: UserSummary | null = siteOwnerFromOffice?.id
    ? {
        id: siteOwnerFromOffice.id,
        tenant_id: office?.tenant_id ?? session?.tenantId ?? '',
        office_id: officeId,
        employee_id: null,
        first_name: siteOwnerFromOffice.name?.split(' ')[0] ?? siteOwnerFromOffice.name ?? '',
        last_name: null,
        display_name: siteOwnerFromOffice.name ?? 'Site owner',
        email: siteOwnerFromOffice.email ?? null,
        phone: null,
        user_type: 'site_owner',
        status: siteOwnerFromOffice.status ?? 'active',
      }
    : adminFromOffice?.id
      ? {
          id: adminFromOffice.id,
          tenant_id: office?.tenant_id ?? session?.tenantId ?? '',
          office_id: officeId,
          employee_id: null,
          first_name: adminFromOffice.name?.split(' ')[0] ?? adminFromOffice.name ?? '',
          last_name: null,
          display_name: adminFromOffice.name ?? 'Branch admin',
          email: adminFromOffice.email ?? null,
          phone: null,
          user_type: 'branch_admin',
          status: adminFromOffice.status ?? 'active',
        }
      : null;

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
  const isSetupRoute = location.pathname.endsWith('/setup');
  const currentSection = useMemo(
    () => branchSettingsSectionFromPath(location.pathname, officeId),
    [location.pathname, officeId],
  );
  const canAccessConfiguredShell = branchState?.status === 'initialized' || forceConfiguredShell;
  const isConfigured = canAccessConfiguredShell && !isSetupRoute;
  const latestValidationSummary = latestBatch?.validation_summary;
  const latestStoredCount = latestValidationSummary?.valid_rows ?? lastUploadStoredCount ?? 0;
  const latestErrorCount = latestValidationSummary?.error_rows ?? 0;
  const missingEmployees = useMemo(
    () => missingEmployeeIds(latestValidationSummary),
    [latestValidationSummary],
  );
  const selectedTemplateKey = officeSettings.payslip_template_key ?? null;
  const wizardTemplateOptions = branchPayslipTemplates.slice(0, 1);
  const adminLoginUrl = office ? buildTenantLoginUrl(office.tenant_id) : '';
  const sitePortalUrl = office?.office_code ? buildSitePortalUrl(office.tenant_id, office.office_code) : '';
  const showEmployeePinSettings = office?.office_type === 'branch';
  const ownerDetailLabel = currentOwner?.display_name
    ?? pendingSiteOwnerInvite?.invited_email
    ?? t('pages.newDash.branchInitialization.labels.unassigned');
  const pendingItems = useMemo(
    () => (branchState ? branchPendingItems(branchState, ownerDetailLabel) : []),
    [branchState, ownerDetailLabel],
  );
  const pendingCount = pendingItems.filter((item) => !item.complete).length;

  const wizardSteps = useMemo(
    () => (branchState ? visibleWizardSteps(branchState, isTenantOwner) : []),
    [branchState, isTenantOwner],
  );

  const derivedStep = useMemo(
    () => (branchState ? deriveWizardStep(branchState, isTenantOwner) : null),
    [branchState, isTenantOwner],
  );

  useEffect(() => {
    setForceConfiguredShell(false);
  }, [officeId]);

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
    if (!branchState) {
      return;
    }

    const basePath = `/new-dash/branches/${officeId}`;
    const setupPath = `${basePath}/setup`;

    if (branchState.status === 'initialized' || forceConfiguredShell) {
      if (isSetupRoute) {
        navigate(basePath, { replace: true });
      }
      return;
    }

    if (!isSetupRoute) {
      navigate(setupPath, { replace: true });
    }
  }, [branchState, forceConfiguredShell, isSetupRoute, navigate, officeId]);

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
      setImportEmployeesMessage(null);
      setMissingEmployeePromptIds([]);
      setMissingEmployeePromptOpen(false);
      setLastUploadStoredCount(result.records_created);
      setSelectedFile(null);
      setCurrentStep('review');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-batches', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-payroll-batches', session?.tenantId] }),
      ]);
    },
    onError: async (error) => {
      const promptIds =
        error instanceof ApiRequestError && error.code === 'VALIDATION_ERROR'
          ? missingEmployeeIdsFromCriticalErrors(
              Array.isArray((error.details?.summary as { critical_errors?: unknown[] } | undefined)?.critical_errors)
                ? ((error.details?.summary as { critical_errors?: unknown[] }).critical_errors ?? []).filter(
                    (value): value is string => typeof value === 'string',
                  )
                : [],
            )
          : [];
      setLastUploadStoredCount(null);
      setImportEmployeesMessage(null);
      setMissingEmployeePromptIds(promptIds);
      setMissingEmployeePromptOpen(promptIds.length > 0);
      setErrorMessage(formatPayrollUploadError(error) ?? t('pages.newDash.branchInitialization.errors.upload'));
      setCurrentStep('review');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-batches', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-payroll-batches', session?.tenantId] }),
      ]);
    },
  });

  const importMissingEmployeesMutation = useMutation({
    mutationFn: async () => {
      if (!session || !latestBatch) {
        throw new Error('No payroll batch is available for employee import.');
      }

      return importMissingEmployeesForPayrollBatch(session, latestBatch.id);
    },
    onSuccess: async (result) => {
      setErrorMessage(null);
      setMissingEmployeePromptOpen(false);
      setMissingEmployeePromptIds([]);
      setLastUploadStoredCount(result.records_created);
      setImportEmployeesMessage(
        result.batch.upload_status === 'processed'
          ? `Added ${result.employees_created} employee${result.employees_created === 1 ? '' : 's'} from this paysheet and stored ${result.records_created} payroll record${result.records_created === 1 ? '' : 's'}.`
          : `Added ${result.employees_created} employee${result.employees_created === 1 ? '' : 's'} from this paysheet. ${result.summary.error_rows ?? 0} payroll issue${result.summary.error_rows === 1 ? '' : 's'} still need attention.`
      );
      if (result.batch.upload_status === 'processed') {
        setCurrentStep('template');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-batches', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['branch-setup-employees', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-payroll-batches', session?.tenantId] }),
      ]);
    },
    onError: (error) => {
      setImportEmployeesMessage(null);
      setErrorMessage(formatPayrollUploadError(error) ?? 'We could not add the missing employees from this paysheet.');
    },
  });

  const showUploadErrorInline = Boolean(errorMessage) && (uploadMutation.isError || importMissingEmployeesMutation.isError);

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
      setImportEmployeesMessage(null);
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
      setForceConfiguredShell(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-office', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-locations', session?.tenantId] }),
      ]);
      navigate(`/new-dash/branches/${officeId}`, { replace: true });
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : t('pages.newDash.branchInitialization.errors.ready'));
    },
  });

  const inviteSiteOwnerMutation = useMutation({
    mutationFn: async () => {
      if (!session || ownerInviteEmail.trim() === '') {
        throw new Error(t('pages.newDash.branchInitialization.errors.owner'));
      }

      return inviteSiteOwner(session, officeId, {
        email: ownerInviteEmail.trim(),
        name: ownerInviteName.trim() !== '' ? ownerInviteName.trim() : undefined,
      });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      setImportEmployeesMessage(null);
      setOwnerInviteEmail('');
      setOwnerInviteName('');
      setCurrentStep('upload');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branch-setup-office', session?.tenantId, officeId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-locations', session?.tenantId] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : t('pages.newDash.branchInitialization.errors.owner'));
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      if (!session) {
        throw new Error('You must be signed in to resend this invitation.');
      }

      return resendSiteOwnerInvite(session, officeId, inviteId);
    },
    onSuccess: async () => {
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: ['branch-setup-office', session?.tenantId, officeId] });
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'We could not resend the invitation.');
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      if (!session) {
        throw new Error('You must be signed in to cancel this invitation.');
      }

      return cancelSiteOwnerInvite(session, officeId, inviteId);
    },
    onSuccess: async () => {
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: ['branch-setup-office', session?.tenantId, officeId] });
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'We could not cancel the invitation.');
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
    (actorQuery.isLoading || officeQuery.isLoading || payrollBatchesQuery.isLoading);
  const hasError = actorQuery.error || officeQuery.error || payrollBatchesQuery.error;
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
        return Boolean(ownerInviteEmail.trim()) && !inviteSiteOwnerMutation.isPending;
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
      setImportEmployeesMessage(null);
      setCurrentStep(previousStep);
    }
  }

  function handleWizardContinue() {
    if (!branchState || !currentStep) {
      return;
    }

    setErrorMessage(null);
    setImportEmployeesMessage(null);

    if (currentStep === 'owner') {
      void inviteSiteOwnerMutation.mutateAsync();
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
          <label>
            <span>Site owner name</span>
            <input
              onChange={(event) => setOwnerInviteName(event.target.value)}
              placeholder="Branch owner name"
              type="text"
              value={ownerInviteName}
            />
          </label>
          <label>
            <span>Site owner email</span>
            <input
              onChange={(event) => setOwnerInviteEmail(event.target.value)}
              placeholder="owner@branch.com"
              type="email"
              value={ownerInviteEmail}
            />
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
          {importEmployeesMessage ? (
            <p className="branch-setup-inline-success">{importEmployeesMessage}</p>
          ) : null}
          {showUploadErrorInline ? (
            <p className="branch-setup-error">{errorMessage}</p>
          ) : null}
          {branchState.isBlocked ? (
            <>
              {missingEmployees.length > 0 ? (
                <div className="branch-setup-guidance-card">
                  <p className="branch-setup-guidance-kicker">Employee setup required</p>
                  <h3>Add employees from this paysheet</h3>
                  <p>
                    This payroll file references {missingEmployees.length} employee{missingEmployees.length === 1 ? '' : 's'} that do not exist in Worknest yet.
                    We can create them in this branch from the uploaded sheet, then retry payroll validation automatically.
                  </p>
                  <div className="branch-setup-guidance-chip-row">
                    {missingEmployees.slice(0, 8).map((employeeId) => (
                      <span className="branch-setup-guidance-chip" key={employeeId}>{employeeId}</span>
                    ))}
                    {missingEmployees.length > 8 ? (
                      <span className="branch-setup-guidance-chip">+{missingEmployees.length - 8} more</span>
                    ) : null}
                  </div>
                  <div className="branch-setup-guidance-actions">
                    <Button
                      disabled={importMissingEmployeesMutation.isPending}
                      onClick={() => {
                        setMissingEmployeePromptIds(missingEmployees);
                        setMissingEmployeePromptOpen(true);
                      }}
                    >
                      Review missing employees
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="branch-setup-inline-warning">
                  {latestValidationSummary?.critical_errors?.[0] ??
                    'This upload needs attention before the branch can move forward.'}
                </p>
              )}
            </>
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
            <strong>{ownerDetailLabel}</strong>
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

  function renderMissingEmployeesModal() {
    if (!missingEmployeePromptOpen || missingEmployeePromptIds.length === 0) {
      return null;
    }

    return (
      <div
        aria-modal="true"
        className="branch-setup-modal-backdrop"
        onClick={() => setMissingEmployeePromptOpen(false)}
        role="dialog"
      >
        <div
          className="branch-setup-modal"
          onClick={(event) => event.stopPropagation()}
          role="document"
        >
          <p className="branch-setup-modal-kicker">Employee sync needed</p>
          <h3>
            {missingEmployeePromptIds.length} user{missingEmployeePromptIds.length === 1 ? '' : 's'} are not in the DB
          </h3>
          <p>
            This paysheet references {missingEmployeePromptIds.length} employee{missingEmployeePromptIds.length === 1 ? '' : 's'} that do not exist in Worknest yet.
            Do you want to add them now?
          </p>
          <div className="branch-setup-guidance-chip-row">
            {missingEmployeePromptIds.slice(0, 10).map((employeeId) => (
              <span className="branch-setup-guidance-chip" key={employeeId}>{employeeId}</span>
            ))}
            {missingEmployeePromptIds.length > 10 ? (
              <span className="branch-setup-guidance-chip">+{missingEmployeePromptIds.length - 10} more</span>
            ) : null}
          </div>
          <div className="branch-setup-modal-actions">
            <Button
              onClick={() => setMissingEmployeePromptOpen(false)}
              type="button"
              variant="secondary"
            >
              Not now
            </Button>
            <Button
              disabled={importMissingEmployeesMutation.isPending}
              onClick={() => void importMissingEmployeesMutation.mutateAsync()}
              type="button"
            >
              {importMissingEmployeesMutation.isPending ? 'Adding users…' : 'Add users now'}
            </Button>
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
                  <strong>{ownerDetailLabel}</strong>
                </div>
                <div>
                  <span>Latest activity</span>
                  <strong>{formatShortDate(branchState.lastActivityAt)}</strong>
                </div>
                <div>
                  <span>Next action</span>
                  <strong>{t(branchState.nextActionLabelKey)}</strong>
                </div>
                <div>
                  <span>Pending items</span>
                  <strong>{pendingCount === 0 ? 'All complete' : `${pendingCount} remaining`}</strong>
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

              {pendingItems.length > 0 ? (
                <div className="branch-setup-pending-panel">
                  <div className="branch-setup-pending-head">
                    <h3>What&apos;s pending</h3>
                    <span>{pendingCount === 0 ? 'All set' : `${pendingCount} left`}</span>
                  </div>
                  <div className="branch-setup-pending-list">
                    {pendingItems.map((item) => (
                      <div className={item.complete ? 'branch-setup-pending-item is-complete' : 'branch-setup-pending-item'} key={item.key}>
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {errorMessage ? <p className="new-dash-setup-error">{errorMessage}</p> : null}

              <div className="new-dash-setup-actions">
                {currentStep === 'complete' ? (
                  <Button
                    onClick={() => {
                      setForceConfiguredShell(true);
                      navigate(`/new-dash/branches/${officeId}`);
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
        {renderMissingEmployeesModal()}
      </NewPrimaryLayout>
    );
  }

  function renderConfiguredSettings() {
    const toolbar = branchState ? (
      <div className="branch-shell-toolbar">
        <p className="new-dash-page-header-note">General branch settings</p>
        <span className={`new-dash-step-status ${statusClassName}`}>
          {t(branchState.statusLabelKey)}
        </span>
      </div>
    ) : undefined;

    const navItems: Array<{ section: BranchSettingsSection; label: string; path: string }> = [
      { section: 'overview', label: 'Overview', path: `/new-dash/branches/${officeId}` },
      { section: 'payroll', label: 'Payroll', path: `/new-dash/branches/${officeId}/payroll` },
      { section: 'employees', label: 'Employees', path: `/new-dash/branches/${officeId}/employees` },
      { section: 'pins', label: 'PIN Access', path: `/new-dash/branches/${officeId}/pins` },
      { section: 'access', label: 'Access & Ownership', path: `/new-dash/branches/${officeId}/access` },
    ];
    const headerNavItems = actor?.user_type === 'site_owner'
      ? newHeaderSiteOwnerNavItems.map((item) => ({
          ...item,
          path: `/new-dash/branches/${officeId}`,
        }))
      : undefined;

    function renderOverviewSection() {
      return (
        <div className="new-dash-stack">
          <section className="new-dash-panel branch-settings-hero">
            <div className="new-dash-panel-head">
              <div>
                <h2>Branch overview</h2>
                <p className="new-dash-panel-copy">
                  Track the health of this branch at a glance and jump into the area that needs attention.
                </p>
              </div>
            </div>
            <div className="branch-setup-pending-banner">
              <strong>{pendingCount === 0 ? 'This branch is fully configured.' : `${pendingCount} setup item${pendingCount === 1 ? '' : 's'} still pending.`}</strong>
              <span>
                {pendingCount === 0
                  ? 'All branch prerequisites are complete.'
                  : pendingItems.filter((item) => !item.complete).map((item) => item.label).join(' · ')}
              </span>
            </div>
            <div className="branch-setup-overview-grid">
              <div className="branch-setup-overview-item">
                <span>Site owner</span>
                <strong>{ownerDetailLabel}</strong>
              </div>
              <div className="branch-setup-overview-item">
                <span>Latest upload</span>
                <strong>{latestBatch?.source_file_name ?? 'No upload yet'}</strong>
              </div>
              <div className="branch-setup-overview-item">
                <span>Last activity</span>
                <strong>{formatShortDate(branchState?.lastActivityAt ?? null)}</strong>
              </div>
              <div className="branch-setup-overview-item">
                <span>Payslip template</span>
                <strong>{officeSettings.payslip_template_name ?? 'Not selected'}</strong>
              </div>
              <div className="branch-setup-overview-item">
                <span>Payroll health</span>
                <strong>{latestBatch?.upload_status === 'processed' ? 'Healthy' : latestBatch ? 'Needs review' : 'Awaiting upload'}</strong>
              </div>
              <div className="branch-setup-overview-item">
                <span>Employees</span>
                <strong>{branchEmployees.length}</strong>
              </div>
            </div>
            <div className="branch-setup-pending-list">
              {pendingItems.map((item) => (
                <div className={item.complete ? 'branch-setup-pending-item is-complete' : 'branch-setup-pending-item'} key={item.key}>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="new-dash-panel">
            <div className="new-dash-panel-head">
              <h2>{t('pages.newDash.branchInitialization.steps.template.title')}</h2>
            </div>
            <p className="new-dash-panel-copy">Choose the default payslip presentation this branch should use going forward.</p>
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

          <section className="new-dash-panel">
            <div className="new-dash-panel-head">
              <h2>Quick links</h2>
            </div>
            <div className="branch-shell-quick-links">
              {navItems.filter((item) => item.section !== 'overview').map((item) => (
                <NavLink className="branch-shell-quick-link" key={item.section} to={item.path}>
                  <strong>{item.label}</strong>
                  <span>Open this branch section</span>
                </NavLink>
              ))}
            </div>
          </section>
        </div>
      );
    }

    function renderPayrollSection() {
      const batches = sortBatches(payrollBatchesQuery.data?.batches ?? []);

      return (
        <div className="new-dash-stack">
          <section className="new-dash-panel branch-setup-step-panel">
            <div className="new-dash-panel-head">
              <h2>Latest payroll upload</h2>
            </div>
            <p className="new-dash-panel-copy">Monitor import health, upload a fresh paysheet, and resolve missing employees without leaving this section.</p>
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
                  missingEmployees.length > 0 ? (
                    <div className="branch-setup-guidance-card is-compact">
                      <p className="branch-setup-guidance-kicker">Employee setup required</p>
                      <h3>Missing employees in this upload</h3>
                      <p>
                        {missingEmployees.length} employee{missingEmployees.length === 1 ? '' : 's'} from the payroll sheet are not in this branch yet.
                        Review them and decide whether to add them now.
                      </p>
                      <div className="branch-setup-guidance-chip-row">
                        {missingEmployees.slice(0, 6).map((employeeId) => (
                          <span className="branch-setup-guidance-chip" key={employeeId}>{employeeId}</span>
                        ))}
                      </div>
                      <div className="branch-setup-guidance-actions">
                        <Button
                          disabled={importMissingEmployeesMutation.isPending}
                          onClick={() => {
                            setMissingEmployeePromptIds(missingEmployees);
                            setMissingEmployeePromptOpen(true);
                          }}
                          type="button"
                        >
                          Review missing employees
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="branch-setup-inline-warning">
                      {latestValidationSummary?.critical_errors?.[0] ?? 'The latest upload needs attention.'}
                    </p>
                  )
                ) : null}
                {importEmployeesMessage ? (
                  <p className="branch-setup-inline-success">{importEmployeesMessage}</p>
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
            {showUploadErrorInline ? (
              <p className="branch-setup-error">{errorMessage}</p>
            ) : null}
          </section>

          <section className="new-dash-panel">
            <div className="new-dash-panel-head">
              <h2>Payroll history</h2>
            </div>
            {batches.length === 0 ? (
              <p className="new-dash-panel-note">No payroll history is available for this branch yet.</p>
            ) : (
              <div className="branch-shell-history-list">
                {batches.map((batch) => (
                  <div className="branch-shell-history-item" key={batch.id}>
                    <div>
                      <strong>{batch.source_file_name}</strong>
                      <span>{`Period ${batch.period_month}/${batch.period_year}`}</span>
                    </div>
                    <div>
                      <strong>{batch.upload_status}</strong>
                      <span>{formatShortDate(batch.updated_at ?? batch.created_at ?? null)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      );
    }

    function renderEmployeesSection() {
      return (
        <section className="new-dash-panel">
          <div className="new-dash-panel-head">
            <div>
              <h2>Employees</h2>
              <p className="new-dash-panel-copy">Review the employee roster for this branch separately from payroll and PIN operations.</p>
            </div>
          </div>
          {branchEmployees.length === 0 ? (
            <p className="new-dash-panel-note">No employees are assigned to this branch yet.</p>
          ) : (
            <div className="branch-shell-employee-list">
              {branchEmployees.map((employee) => (
                <article className="branch-shell-employee-card" key={employee.id}>
                  <div>
                    <strong>{employee.display_name}</strong>
                    <span>{employee.employee_id ?? 'No employee ID'}</span>
                  </div>
                  <div>
                    <strong>{employee.email || employee.phone || 'No login contact'}</strong>
                    <span>{employee.status}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      );
    }

    function renderPinsSection() {
      if (!showEmployeePinSettings) {
        return null;
      }

      return (
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
      );
    }

    function renderAccessSection() {
      return (
        <div className="new-dash-stack">
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
              <p className="new-dash-panel-copy">Invite a branch site owner by email. Existing workspace users will be granted branch access immediately. New users will receive a registration link.</p>
              <div className="branch-setup-overview-grid">
                <div className="branch-setup-overview-item">
                  <span>Active site owner</span>
                  <strong>{ownerDetailLabel}</strong>
                </div>
                <div className="branch-setup-overview-item">
                  <span>Pending invite</span>
                  <strong>{pendingSiteOwnerInvite?.invited_email ?? 'No pending invite'}</strong>
                </div>
              </div>
              <div className="branch-setup-owner-actions">
                <input
                  onChange={(event) => setOwnerInviteName(event.target.value)}
                  placeholder="Site owner name"
                  type="text"
                  value={ownerInviteName}
                />
                <input
                  onChange={(event) => setOwnerInviteEmail(event.target.value)}
                  placeholder="siteowner@company.com"
                  type="email"
                  value={ownerInviteEmail}
                />
                <Button
                  disabled={!ownerInviteEmail.trim() || inviteSiteOwnerMutation.isPending}
                  onClick={() => {
                    void inviteSiteOwnerMutation.mutateAsync();
                  }}
                  type="button"
                >
                  {inviteSiteOwnerMutation.isPending ? 'Sending invite...' : 'Send site owner invite'}
                </Button>
              </div>
              {pendingSiteOwnerInvite ? (
                <div className="new-dash-panel-actions">
                  <Button
                    disabled={resendInviteMutation.isPending}
                    onClick={() => {
                      void resendInviteMutation.mutateAsync(pendingSiteOwnerInvite.id);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {resendInviteMutation.isPending ? 'Resending...' : 'Resend invite'}
                  </Button>
                  <Button
                    disabled={cancelInviteMutation.isPending}
                    onClick={() => {
                      void cancelInviteMutation.mutateAsync(pendingSiteOwnerInvite.id);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {cancelInviteMutation.isPending ? 'Cancelling...' : 'Cancel invite'}
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      );
    }

    function renderConfiguredSection() {
      switch (currentSection) {
        case 'payroll':
          return renderPayrollSection();
        case 'employees':
          return renderEmployeesSection();
        case 'pins':
          return renderPinsSection();
        case 'access':
          return renderAccessSection();
        case 'overview':
        default:
          return renderOverviewSection();
      }
    }

    return (
      <NewPrimaryLayout
        headerBrandPath={actor?.user_type === 'site_owner' ? `/new-dash/branches/${officeId}` : undefined}
        headerNavItems={headerNavItems}
        onLogout={undefined}
        pageHeader={
          <PageHeader
            title={office?.name ?? t('pages.newDash.branchInitialization.workspaceTitle')}
            toolbar={toolbar}
          />
        }
      >
        <section className="new-dash-page">
          <div className="branch-shell">
            <aside className="branch-shell-nav">
              <div className="branch-shell-nav-card">
                <p className="branch-shell-nav-kicker">Branch settings</p>
                <strong>{office?.name ?? 'Branch'}</strong>
                <span>{formatShortDate(branchState?.lastActivityAt ?? null)}</span>
              </div>
              <nav aria-label="Branch settings sections" className="branch-shell-nav-links">
                {navItems.map((item) => (
                  <NavLink
                    className={({ isActive }) =>
                      isActive ? 'branch-shell-nav-link is-active' : 'branch-shell-nav-link'
                    }
                    end={item.section === 'overview'}
                    key={item.section}
                    to={item.path}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </aside>

            <div className="branch-shell-content">
              {renderConfiguredSection()}
              {errorMessage && !showUploadErrorInline ? <p className="branch-setup-error">{errorMessage}</p> : null}
            </div>
          </div>
        </section>
        {renderMissingEmployeesModal()}
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
