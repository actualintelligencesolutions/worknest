import type { TFunction } from 'i18next';
import type { ActorProfile, CompanyLocation, PayrollBatch } from '../../services/worknestApi';

export type SetupStatus = 'not_started' | 'ready' | 'blocked' | 'completed';

export type DashboardStep = {
  id: 'office' | 'plan' | 'payroll';
  title: string;
  helper: string;
  status: SetupStatus;
  statusLabel: string;
  actionLabel: string;
  actionTo: string;
  disabled?: boolean;
};

export const demoActor: Pick<ActorProfile, 'tenant_id' | 'name' | 'user_type'> = {
  tenant_id: 'demo-company',
  name: 'Aarav Rao',
  user_type: 'tenant_owner',
};

export function getMainOffice(locations: CompanyLocation[]) {
  return (
    locations.find((location) => location.location_type === 'main_office') ??
    locations.find((location) => location.office_type === 'main_office') ??
    null
  );
}

export function getBranchLocations(locations: CompanyLocation[]) {
  return locations.filter(
    (location) =>
      location.location_type === 'branch' || location.office_type === 'branch',
  );
}

export function createDashboardState({
  t,
  mainOffice,
  branchCount,
  hasAssignedPlan,
  payrollBatches,
}: {
  t: TFunction;
  mainOffice: CompanyLocation | null;
  branchCount: number;
  hasAssignedPlan: boolean;
  payrollBatches: PayrollBatch[];
}) {
  const hasMainOffice = Boolean(mainOffice);
  const hasBranch = branchCount > 0;
  const hasPayroll = payrollBatches.length > 0;

  const officeStep: DashboardStep = hasMainOffice
    ? {
        id: 'office',
        title: t('pages.newDash.setup.steps.office.title'),
        helper: t('pages.newDash.setup.steps.office.completedHelper'),
        status: 'completed',
        statusLabel: t('pages.newDash.setup.status.completed'),
        actionLabel: t('pages.newDash.setup.steps.office.completedAction'),
        actionTo: '/new-dash/offices',
      }
    : {
        id: 'office',
        title: t('pages.newDash.setup.steps.office.title'),
        helper: t('pages.newDash.setup.steps.office.helper'),
        status: 'ready',
        statusLabel: t('pages.newDash.setup.status.ready'),
        actionLabel: t('pages.newDash.setup.steps.office.action'),
        actionTo: '/new-dash/offices',
      };

  const planContextOfficeId = mainOffice?.id ?? null;

  const planStep: DashboardStep = !hasMainOffice
    ? {
        id: 'plan',
        title: t('pages.newDash.setup.steps.plan.title'),
        helper: t('pages.newDash.setup.steps.plan.blockedHelper'),
        status: 'blocked',
        statusLabel: t('pages.newDash.setup.status.blocked'),
        actionLabel: t('pages.newDash.setup.steps.plan.action'),
        actionTo: '/new-dash/offices',
        disabled: true,
      }
    : hasAssignedPlan
      ? {
          id: 'plan',
          title: t('pages.newDash.setup.steps.plan.title'),
          helper: t('pages.newDash.setup.steps.plan.completedHelper', {
            officeName: mainOffice?.name ?? t('pages.newDash.workspace.fallback'),
          }),
          status: 'completed',
          statusLabel: t('pages.newDash.setup.status.completed'),
          actionLabel: t('pages.newDash.setup.steps.plan.completedAction'),
          actionTo: '/new-dash/offices',
        }
      : {
          id: 'plan',
          title: t('pages.newDash.setup.steps.plan.title'),
          helper: t('pages.newDash.setup.steps.plan.helper', {
            officeName: mainOffice?.name ?? t('pages.newDash.workspace.fallback'),
          }),
          status: 'ready',
          statusLabel: t('pages.newDash.setup.status.ready'),
          actionLabel: t('pages.newDash.setup.steps.plan.action'),
          actionTo: '/new-dash/offices',
        };

  const payrollStep: DashboardStep = hasPayroll
    ? {
        id: 'payroll',
        title: t('pages.newDash.setup.steps.payroll.title'),
        helper: t('pages.newDash.setup.steps.payroll.completedHelper'),
        status: 'completed',
        statusLabel: t('pages.newDash.setup.status.completed'),
        actionLabel: t('pages.newDash.setup.steps.payroll.completedAction'),
        actionTo: '/new-dash/reports',
      }
    : !hasMainOffice
      ? {
          id: 'payroll',
          title: t('pages.newDash.setup.steps.payroll.title'),
          helper: t('pages.newDash.setup.steps.payroll.blockedNoOffice'),
          status: 'blocked',
          statusLabel: t('pages.newDash.setup.status.blocked'),
          actionLabel: t('pages.newDash.setup.steps.payroll.action'),
          actionTo: '/new-dash/reports',
          disabled: true,
        }
      : !hasAssignedPlan
        ? {
            id: 'payroll',
            title: t('pages.newDash.setup.steps.payroll.title'),
            helper: t('pages.newDash.setup.steps.payroll.blockedNoPlan'),
            status: 'blocked',
            statusLabel: t('pages.newDash.setup.status.blocked'),
            actionLabel: t('pages.newDash.setup.steps.payroll.action'),
            actionTo: '/new-dash/reports',
            disabled: true,
          }
        : !hasBranch
          ? {
              id: 'payroll',
              title: t('pages.newDash.setup.steps.payroll.title'),
              helper: t('pages.newDash.setup.steps.payroll.blockedNoBranch'),
              status: 'blocked',
              statusLabel: t('pages.newDash.setup.status.blocked'),
              actionLabel: t('pages.newDash.setup.steps.payroll.action'),
              actionTo: '/new-dash/offices',
              disabled: true,
            }
          : {
              id: 'payroll',
              title: t('pages.newDash.setup.steps.payroll.title'),
              helper: t('pages.newDash.setup.steps.payroll.helper'),
              status: 'ready',
              statusLabel: t('pages.newDash.setup.status.ready'),
              actionLabel: t('pages.newDash.setup.steps.payroll.action'),
              actionTo: '/new-dash/reports',
            };

  const steps = [officeStep, planStep, payrollStep];
  const completedCount = steps.filter((step) => step.status === 'completed').length;
  const isBrandNew = !hasMainOffice && !hasAssignedPlan && !hasPayroll;
  const readinessKey =
    completedCount === 3
      ? 'pages.newDash.setup.banner.complete'
      : 'pages.newDash.setup.banner.incomplete';

  return {
    completedCount,
    hasMainOffice,
    hasAssignedPlan,
    hasPayroll,
    isBrandNew,
    steps,
    readinessTitle: t(readinessKey),
    readinessSummary:
      completedCount === 3
        ? t('pages.newDash.setup.banner.completeSummary')
        : t('pages.newDash.setup.banner.incompleteSummary', {
            count: completedCount,
          }),
  };
}
