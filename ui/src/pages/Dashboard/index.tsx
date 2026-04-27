import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppLayout } from '../../layouts/AppLayout';
import { loadHrSession } from '../../services/hrSession';
import {
  listCompanyLocations,
  type AuthSession,
  type CompanyLocation,
} from '../../services/worknestApi';
import { useTenantStore } from '../../stores/tenantStore';
import './style.scss';

const setupActions = [
  {
    title: 'Setup Main Office Account',
    description:
      'Create a head office account with its admin and package setup.',
    to: '/dashboard/main-office',
  },
  {
    title: 'Setup Branch Account',
    description: 'Create a branch account with its admin and package setup.',
    to: '/dashboard/branches/new',
  },
];

type LocationSummary = {
  main_offices: number;
  branches: number;
  total: number;
};

export function DashboardPage() {
  const tenant = useTenantStore((state) => state.tenant);
  usePageTitle('Dashboard');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [summary, setSummary] = useState<LocationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const loadWorkspaceLocations = useCallback(
    async (
      activeSession: AuthSession,
      shouldApply: () => boolean = () => true,
    ) => {
      setIsLoading(true);
      setNotice(null);

      try {
        const response = await listCompanyLocations(activeSession);
        if (!shouldApply()) {
          return;
        }
        setLocations(response.locations);
        setSummary(response.summary);
      } catch {
        if (!shouldApply()) {
          return;
        }
        setNotice('Something went wrong while loading your workspace.');
      } finally {
        if (shouldApply()) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const storedSession = loadHrSession();
    setSession(storedSession);
    if (!storedSession) {
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    void loadWorkspaceLocations(storedSession, () => isCurrent);

    return () => {
      isCurrent = false;
    };
  }, [loadWorkspaceLocations]);

  const hasLoadError = Boolean(notice);
  const hasNoLocations =
    Boolean(session) &&
    !isLoading &&
    !hasLoadError &&
    (summary?.total ?? locations.length) === 0;
  const welcomeTitle = session?.userName
    ? `Welcome to Worknest, ${session.userName} 👋`
    : 'Welcome to Worknest 👋';

  return (
    <AppLayout tenant={tenant}>
      <section className="dashboard-page" aria-labelledby="dashboard-title">
        <div className="dashboard-heading">
          <p className="eyebrow">Dashboard</p>
          <h1 id="dashboard-title">
            {hasNoLocations ? welcomeTitle : 'Finish your workspace setup'}
          </h1>
          <p>
            {hasNoLocations
              ? 'Let’s set up your workspace in 2 simple steps. Start with your main office, or create a branch account first if that fits your rollout.'
              : 'Manage offices, branches, and the setup tasks that keep Worknest ready for your team.'}
          </p>
        </div>

        {notice ? (
          <div className="dashboard-notice" role="alert">
            <div>
              <strong>{notice}</strong>
              <span>
                Please try again, or contact support if the problem continues.
              </span>
            </div>
            <div className="dashboard-notice-actions">
              {session ? (
                <button
                  className="button button-secondary"
                  onClick={() => void loadWorkspaceLocations(session)}
                  type="button"
                >
                  Retry
                </button>
              ) : null}
              <Link className="button button-primary" to="/contact">
                Contact Support
              </Link>
            </div>
          </div>
        ) : null}

        {isLoading ? <div className="dashboard-loading">Loading...</div> : null}

        {!isLoading && !session ? (
          <div className="dashboard-welcome-card">
            <div className="dashboard-welcome-copy">
              <span className="dashboard-welcome-mark">1</span>
              <h2>Sign in to continue setup</h2>
              <p>
                Use the HR admin account from registration to continue building
                your workspace.
              </p>
            </div>
            <Link className="button button-primary" to="/login">
              Login
            </Link>
          </div>
        ) : null}

        {session && hasNoLocations ? (
          <div className="dashboard-onboarding">
            <div className="dashboard-empty-visual" aria-hidden="true">
              <div className="dashboard-building">
                <span />
                <span />
                <span />
                <span />
              </div>
              <i />
              <i />
              <i />
            </div>

            <div className="dashboard-primary-setup">
              <div
                className="dashboard-progress"
                aria-label="Suggested setup path"
              >
                <span>Suggested start</span>
                <div>
                  <strong>Main Office</strong>
                  <span>Branches</span>
                </div>
              </div>
              <Link
                className="button button-primary dashboard-primary-action"
                to="/dashboard/main-office"
              >
                Create Main Office
              </Link>
              <p>
                This is usually the best starting point for a new workspace.
                You can also create a branch account first if your setup starts
                at a branch location.
              </p>
              <Link
                className="dashboard-secondary-link"
                to="/dashboard/branches/new"
              >
                Create Branch Account instead
              </Link>
            </div>

            <div className="dashboard-next-steps">
              <span>As your workspace grows, you can:</span>
              <ul>
                <li>Add branch offices</li>
                <li>Invite admins</li>
                <li>Configure packages</li>
              </ul>
            </div>
          </div>
        ) : null}

        {session && !hasNoLocations && !isLoading && !hasLoadError ? (
          <>
            <div className="dashboard-summary">
              <div>
                <span>Main offices</span>
                <strong>{summary?.main_offices ?? 0}</strong>
              </div>
              <div>
                <span>Branches</span>
                <strong>{summary?.branches ?? 0}</strong>
              </div>
              <div>
                <span>Total locations</span>
                <strong>{summary?.total ?? locations.length}</strong>
              </div>
            </div>

            <div className="dashboard-actions" aria-label="Setup actions">
              {setupActions.map((action) => (
                <Link
                  className="dashboard-action"
                  key={action.title}
                  to={action.to}
                >
                  <span>{action.title}</span>
                  <small>{action.description}</small>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </AppLayout>
  );
}
