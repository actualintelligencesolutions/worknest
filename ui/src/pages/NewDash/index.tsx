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
import {
  getCurrentActor,
  getOffice,
  listCompanyLocations,
  listPayrollBatches,
  listUsers,
  logout,
} from '../../services/worknestApi';
import { computeBranchInitializationState } from './branchInitialization';
import {
  createDashboardState,
  demoActor,
  getBranchLocations,
  getPrimaryWorkspaceLocation,
} from './dashboardState';
import './style.scss';

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

function formatActorRole(userType: string | undefined) {
  switch (userType) {
    case 'branch_admin':
      return 'Branch Admin';
    case 'tenant_owner':
      return 'Super Admin';
    case 'employee':
      return 'Employee';
    default:
      return 'Workspace User';
  }
}

function formatWorkspaceMeta(city?: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(', ') || 'Workspace hub';
}

function getInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

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

  const usersQuery = useQuery({
    queryKey: ['new-dash-users', session?.tenantId],
    queryFn: () => listUsers(session!, { user_type: 'branch_admin' }),
    enabled: Boolean(session),
  });

  const locations = locationsQuery.data?.locations ?? [];
  const primaryWorkspaceLocation = useMemo(
    () => getPrimaryWorkspaceLocation(locations),
    [locations],
  );
  const branchLocations = useMemo(() => getBranchLocations(locations), [locations]);
  const branchAdmins = usersQuery.data?.users ?? [];
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
      usersQuery.isLoading ||
      payrollQuery.isLoading ||
      (Boolean(planContextOfficeId) && planQuery.isLoading));

  const hasError =
    (!isDemoMode && actorQuery.error) ||
    locationsQuery.error ||
    usersQuery.error ||
    payrollQuery.error ||
    planQuery.error;

  const branchStates = useMemo(() => {
    const batches = payrollQuery.data?.batches ?? [];
    return branchLocations.map((branch) => {
      const latestBatch =
        [...batches]
          .filter((batch) => batch.office_id === branch.id)
          .sort((a, b) => {
            const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
            const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
            return bTime - aTime;
          })[0] ?? null;

      const owner =
        branchAdmins.find((user) => user.office_id === branch.id) ?? null;

      return computeBranchInitializationState({
        branch,
        owner,
        latestBatch,
      });
    });
  }, [branchAdmins, branchLocations, payrollQuery.data?.batches]);

  const branchStatusCounts = useMemo(
    () =>
      branchStates.reduce<Record<string, number>>((accumulator, branchState) => {
        accumulator[branchState.status] = (accumulator[branchState.status] ?? 0) + 1;
        return accumulator;
      }, {}),
    [branchStates],
  );

  const pendingBranch = useMemo(
    () => branchStates.find((branchState) => branchState.status !== 'initialized') ?? null,
    [branchStates],
  );

  const branchCount = branchStates.length;
  const initializedCount = branchStatusCounts.initialized ?? 0;
  const blockedCount = branchStatusCounts.blocked ?? 0;
  const unassignedCount = branchStatusCounts.unassigned ?? 0;
  const activeCount = Math.max(branchCount - initializedCount, 0);
  const progressPercent =
    dashboardState.steps.length > 0
      ? Math.round((dashboardState.completedCount / dashboardState.steps.length) * 100)
      : 0;
  const payrollBatchCount = payrollQuery.data?.batches?.length ?? 0;
  const spotlightBranches =
    actor?.user_type === 'branch_admin' ? branchStates.slice(0, 2) : branchStates.slice(0, 4);
  const workspaceMeta = formatWorkspaceMeta(
    primaryWorkspaceLocation?.city,
    primaryWorkspaceLocation?.state,
  );
  const actorRole = formatActorRole(actor?.user_type);
  const rightRailCards = [
    { label: 'Open branches', value: activeCount, tone: 'mint' },
    { label: 'Blocked branches', value: blockedCount, tone: 'amber' },
    { label: 'Ready branches', value: initializedCount, tone: 'deep' },
  ];

  useEffect(() => {
    if (!session || isDemoMode || locationsQuery.isLoading || hasError) {
      return;
    }

    if (!primaryWorkspaceLocation) {
      navigate('/new-dash/setup', { replace: true });
    }
  }, [session, isDemoMode, locationsQuery.isLoading, hasError, primaryWorkspaceLocation, navigate]);

  useEffect(() => {
    if (!session || actor?.user_type !== 'branch_admin' || isBrandNew || isLoading || hasError) {
      return;
    }

    const pendingBranches = branchStates.filter((branchState) => branchState.status !== 'initialized');
    if (pendingBranches.length === 1) {
      navigate(`/new-dash/branches/${pendingBranches[0].branch.id}/setup`, { replace: true });
    }
  }, [actor?.user_type, branchStates, hasError, isBrandNew, isLoading, navigate, session]);

  const toolbar = (
    <p className="new-dash-page-header-note">
      {isDemoMode
        ? t('pages.newDash.demoMode.toolbar')
        : actor?.user_type === 'branch_admin'
          ? t('pages.newDash.branchInitialization.branchOwnerToolbar')
          : t('pages.newDash.branchInitialization.superAdminToolbar')}
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
          <div className="new-dash-board">
            <div className="new-dash-board-main">
              <section className="new-dash-hero-card">
                <div className="new-dash-hero-copy">
                  <span className="new-dash-eyebrow">
                    {actor?.user_type === 'branch_admin' ? 'Branch overview' : 'Workspace overview'}
                  </span>
                  <h2>
                    {isBrandNew
                      ? t('pages.newDash.brandNew.title')
                      : t('pages.newDash.readyWorkspace.title')}
                  </h2>
                  <p>
                    {isBrandNew
                      ? t('pages.newDash.brandNew.description')
                      : dashboardState.readinessSummary}
                  </p>
                </div>
                <div className="new-dash-hero-progress">
                  <span>Setup progress</span>
                  <strong>{progressPercent}%</strong>
                  <div className="new-dash-progress-track" aria-hidden="true">
                    <span style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p>{dashboardState.completedCount} of {dashboardState.steps.length} core stages completed</p>
                </div>
              </section>

              <section className="new-dash-metrics-grid">
                <article className="new-dash-metric-card new-dash-metric-card-highlight">
                  <span>Branch network</span>
                  <strong>{branchCount}</strong>
                  <p>
                    {branchCount > 0
                      ? `${initializedCount} configured, ${activeCount} still moving through setup.`
                      : 'Add your first branch to start payroll operations.'}
                  </p>
                </article>
                <article className="new-dash-metric-card">
                  <span>Payroll uploads</span>
                  <strong>{payrollBatchCount}</strong>
                  <p>
                    {blockedCount > 0
                      ? `${blockedCount} branch uploads need review before launch.`
                      : 'No validation blockers are slowing the rollout right now.'}
                  </p>
                </article>
                <article className="new-dash-metric-card new-dash-metric-card-accent">
                  <span>Owner coverage</span>
                  <strong>{branchCount - unassignedCount}</strong>
                  <p>
                    {unassignedCount > 0
                      ? `${unassignedCount} branches still need a site owner assigned.`
                      : 'Every listed branch has an owner in place.'}
                  </p>
                </article>
              </section>

              <section className="new-dash-workflow-card">
                <div className="new-dash-section-head">
                  <div>
                    <span className="new-dash-eyebrow">Sequence</span>
                    <h3>Operational setup flow</h3>
                  </div>
                  {!isBrandNew ? (
                    <Button
                      as={Link}
                      to={pendingBranch ? `/new-dash/branches/${pendingBranch.branch.id}/setup` : '/new-dash/offices'}
                    >
                      {pendingBranch
                        ? t('pages.newDash.branchInitialization.actions.openBranchSetup')
                        : t('pages.newDash.setup.steps.office.completedAction')}
                    </Button>
                  ) : (
                    <Button as={Link} to="/new-dash/setup">
                      {t('pages.newDash.brandNew.action')}
                    </Button>
                  )}
                </div>

                <div className="new-dash-sequence-grid">
                  {dashboardState.steps.map((step, index) => (
                    <article className={`new-dash-sequence-step ${step.status}`} key={step.id}>
                      <span className="new-dash-sequence-index">0{index + 1}</span>
                      <h4>{step.title}</h4>
                      <p>{step.helper}</p>
                      <div className="new-dash-sequence-footer">
                        <span className={`new-dash-step-status ${step.status}`}>
                          {step.statusLabel}
                        </span>
                        <Link className="new-dash-inline-link" to={step.actionTo}>
                          {step.actionLabel}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="new-dash-portfolio-card">
                <div className="new-dash-section-head">
                  <div>
                    <span className="new-dash-eyebrow">Portfolio</span>
                    <h3>
                      {actor?.user_type === 'branch_admin'
                        ? t('pages.newDash.branchInitialization.branchOwnerTitle')
                        : t('pages.newDash.branchInitialization.superAdminTitle')}
                    </h3>
                    <p className="new-dash-section-copy">
                      {actor?.user_type === 'branch_admin'
                        ? t('pages.newDash.branchInitialization.branchOwnerDescription')
                        : t('pages.newDash.branchInitialization.superAdminDescription')}
                    </p>
                  </div>
                </div>

                <div className="new-dash-branch-grid">
                  {spotlightBranches.map((branchState) => (
                    <article className="new-dash-branch-card" key={branchState.branch.id}>
                      <div className="new-dash-branch-card-meta">
                        <span className="new-dash-branch-timestamp">
                          {formatShortDate(branchState.lastActivityAt)}
                        </span>
                        <span className={`new-dash-step-status ${branchState.status}`}>
                          {t(branchState.statusLabelKey)}
                        </span>
                      </div>
                      <div className="new-dash-branch-card-head">
                        <div className="new-dash-branch-card-copy">
                          <h3>{branchState.branch.name}</h3>
                          <span className="new-dash-branch-card-kicker">
                            {branchState.owner?.display_name ?? 'Owner assignment pending'}
                          </span>
                          <p>{t(branchState.summaryKey)}</p>
                        </div>
                        <span className="new-dash-branch-card-glyph" aria-hidden="true">
                          {branchState.status === 'blocked' ? '!' : '✦'}
                        </span>
                      </div>
                      <div className="new-dash-branch-card-footer">
                        <div className="new-dash-branch-card-owner">
                          <span className="new-dash-branch-card-avatar" aria-hidden="true">
                            {getInitials(
                              branchState.owner?.display_name ??
                                t('pages.newDash.branchInitialization.labels.unassigned'),
                            )}
                          </span>
                          <div>
                            <span>{t('pages.newDash.branchInitialization.card.owner')}</span>
                            <strong>
                              {branchState.owner?.display_name ??
                                t('pages.newDash.branchInitialization.labels.unassigned')}
                            </strong>
                          </div>
                        </div>
                        <div className="new-dash-branch-card-next">
                          <span>{t('pages.newDash.branchInitialization.card.nextStep')}</span>
                          <strong>{t(branchState.nextActionLabelKey)}</strong>
                        </div>
                      </div>
                      <div className="new-dash-panel-actions">
                        <Button as={Link} to={`/new-dash/branches/${branchState.branch.id}/setup`}>
                          {actor?.user_type === 'branch_admin'
                            ? t('pages.newDash.branchInitialization.actions.resumeInitialization')
                            : t('pages.newDash.branchInitialization.actions.openBranchSetup')}
                        </Button>
                        {actor?.user_type !== 'branch_admin' ? (
                          <Button as={Link} to="/new-dash/team" variant="secondary">
                            {t('pages.newDash.branchInitialization.actions.assignOwner')}
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="new-dash-board-rail">
              <section className="new-dash-rail-profile">
                <span className="new-dash-eyebrow">Operator</span>
                <h3>{actor?.name ?? 'Workspace Admin'}</h3>
                <p>{actorRole}</p>
                <div className="new-dash-rail-meta">
                  <div>
                    <span>Workspace</span>
                    <strong>{primaryWorkspaceLocation?.name ?? 'Setup pending'}</strong>
                  </div>
                  <div>
                    <span>Region</span>
                    <strong>{workspaceMeta}</strong>
                  </div>
                  <div>
                    <span>Plan</span>
                    <strong>{planQuery.data?.plan?.name ?? 'Plan pending'}</strong>
                  </div>
                </div>
              </section>

              <section className="new-dash-rail-panel">
                <div className="new-dash-rail-panel-head">
                  <h3>Case overview</h3>
                  <span>{progressPercent}% live</span>
                </div>
                <div className="new-dash-rail-stat-list">
                  {rightRailCards.map((card) => (
                    <article className={`new-dash-rail-stat ${card.tone}`} key={card.label}>
                      <div>
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="new-dash-rail-panel">
                <div className="new-dash-rail-panel-head">
                  <h3>Next move</h3>
                </div>
                {pendingBranch ? (
                  <div className="new-dash-rail-callout">
                    <span className={`new-dash-step-status ${pendingBranch.status}`}>
                      {t(pendingBranch.statusLabelKey)}
                    </span>
                    <strong>{pendingBranch.branch.name}</strong>
                    <p>{t(pendingBranch.summaryKey)}</p>
                    <Button as={Link} to={`/new-dash/branches/${pendingBranch.branch.id}/setup`}>
                      {t(pendingBranch.nextActionLabelKey)}
                    </Button>
                  </div>
                ) : (
                  <div className="new-dash-rail-callout">
                    <span className="new-dash-step-status completed">
                      {t('pages.newDash.setup.status.completed')}
                    </span>
                    <strong>Workspace running smoothly</strong>
                    <p>All tracked setup stages are complete. You can move into reports or team updates.</p>
                    <Button as={Link} to="/new-dash/reports">
                      {t('pages.newDash.setup.steps.payroll.completedAction')}
                    </Button>
                  </div>
                )}
              </section>
            </aside>
          </div>
        )}
      </section>
    </NewPrimaryLayout>
  );
}
