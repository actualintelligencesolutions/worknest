import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { PageHeader } from '../../components/organisms/PageHeader';
import { newHeaderSetupNavItems } from '../../config/newHeader';
import { usePageTitle } from '../../hooks/usePageTitle';
import { NewPrimaryLayout } from '../../layouts/NewPrimary';
import { loadHrSession } from '../../services/hrSession';
import { getCurrentActor, getOffice, listCompanyLocations, listPayrollBatches } from '../../services/worknestApi';
import {
  createDashboardState,
  demoActor,
  getBranchLocations,
  getMainOffice,
} from './dashboardState';
import './style.scss';

export function SetupWorkspacePage() {
  const { t } = useTranslation();
  const session = loadHrSession();
  usePageTitle(t('pages.newDash.setupWorkspace.title'));

  const actorQuery = useQuery({
    queryKey: ['setup-workspace-actor', session?.tenantId],
    queryFn: () => getCurrentActor(session!),
    enabled: Boolean(session),
  });

  const locationsQuery = useQuery({
    queryKey: ['setup-workspace-locations', session?.tenantId],
    queryFn: () => listCompanyLocations(session!),
    enabled: Boolean(session),
  });

  const payrollQuery = useQuery({
    queryKey: ['setup-workspace-payroll-batches', session?.tenantId],
    queryFn: () => listPayrollBatches(session!),
    enabled: Boolean(session),
  });

  const locations = locationsQuery.data?.locations ?? [];
  const mainOffice = useMemo(() => getMainOffice(locations), [locations]);
  const branchLocations = useMemo(() => getBranchLocations(locations), [locations]);
  const planContextOfficeId = mainOffice?.id ?? null;

  const planQuery = useQuery({
    queryKey: ['setup-workspace-office-plan', session?.tenantId, planContextOfficeId],
    queryFn: () => getOffice(session!, planContextOfficeId!),
    enabled: Boolean(session && planContextOfficeId),
  });

  const isDemoMode = !session;
  const actor = actorQuery.data?.actor ?? demoActor;
  const dashboardState = useMemo(
    () =>
      createDashboardState({
        t,
        mainOffice,
        branchCount: branchLocations.length,
        hasAssignedPlan: Boolean(planQuery.data?.plan?.id),
        payrollBatches: payrollQuery.data?.batches ?? [],
      }),
    [branchLocations.length, mainOffice, payrollQuery.data?.batches, planQuery.data?.plan?.id, t],
  );

  const isLoading =
    !isDemoMode &&
    (actorQuery.isLoading ||
      locationsQuery.isLoading ||
      payrollQuery.isLoading ||
      (Boolean(planContextOfficeId) && planQuery.isLoading));

  const hasError =
    (!isDemoMode && actorQuery.error) ||
    locationsQuery.error ||
    payrollQuery.error ||
    planQuery.error;

  const toolbar = (
    <p className="new-dash-page-header-note">
      {isDemoMode ? t('pages.newDash.demoMode.toolbar') : dashboardState.readinessTitle}
    </p>
  );

  return (
    <NewPrimaryLayout
      headerNavItems={newHeaderSetupNavItems}
      pageHeader={
        <PageHeader title={t('pages.newDash.setupWorkspace.title')} toolbar={toolbar} />
      }
    >
      <section className="new-dash-page">
        {isLoading ? (
          <div className="new-dash-panel">
            <div className="new-dash-panel-head">
              <h2>{t('pages.newDash.loading.title')}</h2>
            </div>
            <p className="new-dash-panel-copy">{t('common.loading')}</p>
          </div>
        ) : hasError ? (
          <div className="new-dash-panel">
            <div className="new-dash-panel-head">
              <h2>{t('pages.newDash.error.title')}</h2>
            </div>
            <p className="new-dash-panel-copy">{(hasError as Error).message}</p>
          </div>
        ) : (
          <div className="new-dash-stack">
            <section className="new-dash-setup-card">
              <div className="new-dash-setup-card-head">
                <div>
                  <p className="eyebrow">{t('pages.newDash.setup.eyebrow')}</p>
                  <h2>{dashboardState.readinessTitle}</h2>
                </div>
                <p className="new-dash-progress">
                  {t('pages.newDash.setup.progress', {
                    count: dashboardState.completedCount,
                  })}
                </p>
              </div>

              <p className="new-dash-panel-copy">{dashboardState.readinessSummary}</p>

              <div className="new-dash-step-list">
                {dashboardState.steps.map((step) => (
                  <article className="new-dash-step-card" key={step.id}>
                    <div className="new-dash-step-head">
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.helper}</p>
                      </div>
                      <span className={`new-dash-step-status ${step.status}`}>
                        {step.statusLabel}
                      </span>
                    </div>

                    <div className="new-dash-step-actions">
                      {step.disabled ? (
                        <span className="new-dash-step-disabled">{step.actionLabel}</span>
                      ) : (
                        <Button
                          as={Link}
                          to={step.actionTo}
                          variant={step.status === 'completed' ? 'secondary' : 'primary'}
                        >
                          {step.actionLabel}
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <div className="new-dash-secondary-grid">
              <section className="new-dash-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.workspace.title')}</h2>
                </div>
                {isDemoMode ? (
                  <p className="new-dash-panel-note">{t('pages.newDash.demoMode.banner')}</p>
                ) : null}
                <div className="new-dash-detail-list">
                  <div className="new-dash-detail-row">
                    <span>{t('pages.newDash.workspace.tenant')}</span>
                    <strong>{actor.tenant_id ?? t('pages.newDash.workspace.fallback')}</strong>
                  </div>
                  <div className="new-dash-detail-row">
                    <span>{t('pages.newDash.workspace.signedInAs')}</span>
                    <strong>{actor.name ?? t('pages.newDash.workspace.fallback')}</strong>
                  </div>
                  <div className="new-dash-detail-row">
                    <span>{t('pages.newDash.workspace.role')}</span>
                    <strong>{actor.user_type ?? t('pages.newDash.workspace.fallback')}</strong>
                  </div>
                </div>
              </section>

              <section className="new-dash-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.support.title')}</h2>
                </div>
                <p className="new-dash-panel-copy">{t('pages.newDash.support.description')}</p>
                <div className="new-dash-panel-actions">
                  <Button as={Link} to="/new-dash/help" variant="secondary">
                    {t('pages.newDash.support.action')}
                  </Button>
                </div>
              </section>
            </div>
          </div>
        )}
      </section>
    </NewPrimaryLayout>
  );
}
