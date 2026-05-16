import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { PageHeader } from '../../components/organisms/PageHeader';
import { newHeaderSetupNavItems } from '../../config/newHeader';
import { usePageTitle } from '../../hooks/usePageTitle';
import { NewPrimaryLayout } from '../../layouts/NewPrimary';
import { clearHrSession, loadHrSession } from '../../services/hrSession';
import { getCurrentActor, getOffice, listCompanyLocations, listPayrollBatches, logout } from '../../services/worknestApi';
import {
  createDashboardState,
  demoActor,
  getBranchLocations,
  getPrimaryWorkspaceLocation,
} from './dashboardState';
import './style.scss';

export function NewDashPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = loadHrSession();
  usePageTitle(t('pages.newDash.dashboardTitle'));

  async function handleLogout() {
    try {
      if (session) {
        await logout(session);
      }
    } catch {
      // Local session cleanup still signs the user out even if the API call fails.
    } finally {
      clearHrSession();
      navigate('/login');
    }
  }

  const actorQuery = useQuery({
    queryKey: ['new-dash-actor', session?.tenantId],
    queryFn: () => getCurrentActor(session!),
    enabled: Boolean(session),
  });

  const locationsQuery = useQuery({
    queryKey: ['new-dash-locations', session?.tenantId],
    queryFn: () => listCompanyLocations(session!),
    enabled: Boolean(session),
  });

  const payrollQuery = useQuery({
    queryKey: ['new-dash-payroll-batches', session?.tenantId],
    queryFn: () => listPayrollBatches(session!),
    enabled: Boolean(session),
  });

  const locations = locationsQuery.data?.locations ?? [];
  const primaryWorkspaceLocation = useMemo(
    () => getPrimaryWorkspaceLocation(locations),
    [locations],
  );
  const branchLocations = useMemo(() => getBranchLocations(locations), [locations]);
  const planContextOfficeId = primaryWorkspaceLocation?.id ?? null;

  const planQuery = useQuery({
    queryKey: ['new-dash-office-plan', session?.tenantId, planContextOfficeId],
    queryFn: () => getOffice(session!, planContextOfficeId!),
    enabled: Boolean(session && planContextOfficeId),
  });

  const isDemoMode = !session;
  const actor = actorQuery.data?.actor ?? demoActor;

  const dashboardState = useMemo(
    () =>
      createDashboardState({
        t,
        mainOffice: primaryWorkspaceLocation,
        branchCount: branchLocations.length,
        hasAssignedPlan: Boolean(planQuery.data?.plan?.id),
        payrollBatches: payrollQuery.data?.batches ?? [],
      }),
    [
      branchLocations.length,
      payrollQuery.data?.batches,
      planQuery.data?.plan?.id,
      primaryWorkspaceLocation,
      t,
    ],
  );

  const isBrandNew = isDemoMode || dashboardState.isBrandNew;
  const headerNavItems = isBrandNew ? newHeaderSetupNavItems : undefined;

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

  useEffect(() => {
    if (!session || isDemoMode || locationsQuery.isLoading || hasError) {
      return;
    }

    if (!primaryWorkspaceLocation) {
      navigate('/new-dash/setup', { replace: true });
    }
  }, [session, isDemoMode, locationsQuery.isLoading, hasError, primaryWorkspaceLocation, navigate]);

  const toolbar = (
    <p className="new-dash-page-header-note">
      {isDemoMode ? t('pages.newDash.demoMode.toolbar') : t('pages.newDash.dashboardToolbar')}
    </p>
  );

  return (
    <NewPrimaryLayout
      headerNavItems={headerNavItems}
      onLogout={session ? handleLogout : undefined}
      pageHeader={<PageHeader title={t('pages.newDash.dashboardTitle')} toolbar={toolbar} />}
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
            {isBrandNew ? (
              <section className="new-dash-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.brandNew.title')}</h2>
                </div>
                <p className="new-dash-panel-copy">{t('pages.newDash.brandNew.description')}</p>
                <div className="new-dash-panel-actions">
                  <Button as={Link} to="/new-dash/setup">
                    {t('pages.newDash.brandNew.action')}
                  </Button>
                </div>
              </section>
            ) : (
              <section className="new-dash-panel">
                <div className="new-dash-panel-head">
                  <h2>{t('pages.newDash.readyWorkspace.title')}</h2>
                </div>
                <p className="new-dash-panel-copy">{dashboardState.readinessSummary}</p>
              </section>
            )}

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
