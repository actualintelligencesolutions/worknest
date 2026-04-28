import { type CSSProperties, useCallback, useEffect, useState } from 'react';
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

type LocationSummary = {
  main_offices: number;
  branches: number;
  total: number;
};

function getBranchAvatar(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  const cells = Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5);
    const column = index % 5;
    const mirroredColumn = column > 2 ? 4 - column : column;
    const bitIndex = row * 3 + mirroredColumn;
    return Boolean((hash >> bitIndex) & 1);
  });

  return {
    cells,
    color: `hsl(${hash % 360} 68% 40%)`,
  };
}

function BranchAvatar({ seed }: { seed: string }) {
  const avatar = getBranchAvatar(seed);

  return (
    <div
      aria-hidden="true"
      className="dashboard-branch-avatar"
      style={{ '--avatar-color': avatar.color } as CSSProperties}
    >
      {avatar.cells.map((isFilled, index) => (
        <i className={isFilled ? 'is-filled' : undefined} key={index} />
      ))}
    </div>
  );
}

function getLocationSince(createdAt?: string) {
  if (!createdAt) {
    return null;
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function getStatusMeta(status: string) {
  const normalized = status?.toLowerCase();

  switch (normalized) {
    case 'active':
      return {
        label: 'Active',
        color: '#166534',
        background: '#dcfce7',
        dot: '#16a34a',
        tooltip: 'Subscription active.',
      };
    case 'trial':
      return {
        label: 'Trial',
        color: '#78350f',
        background: '#fef3c7',
        dot: '#f59e0b',
        tooltip: 'Trial period in effect.',
      };
    case 'expired':
      return {
        label: 'Expired',
        color: '#991b1b',
        background: '#fee2e2',
        dot: '#dc2626',
        tooltip: 'Subscription expired.',
      };
    case 'pending_setup':
      return {
        label: 'Pending Setup',
        color: '#7c2d12',
        background: '#fed7aa',
        dot: '#ea580c',
        tooltip: 'Setup in progress.',
      };
    case 'inactive':
      return {
        label: 'Inactive',
        color: '#374151',
        background: '#f3f4f6',
        dot: '#6b7280',
        tooltip: 'Subscription inactive.',
      };
    case 'suspended':
      return {
        label: 'Suspended',
        color: '#92400e',
        background: '#fed7aa',
        dot: '#d97706',
        tooltip: 'Subscription suspended.',
      };
    default:
      return {
        label: status ? status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown',
        color: '#334155',
        background: '#f1f5f9',
        dot: '#94a3b8',
        tooltip: 'Subscription status unknown.',
      };
  }
}

export function DashboardPage() {
  const tenant = useTenantStore((state) => state.tenant);
  usePageTitle('Dashboard');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [summary, setSummary] = useState<LocationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [branchSearch, setBranchSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [branchSort, setBranchSort] = useState('name-asc');

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
  const mainOfficeCount = summary?.main_offices ?? 0;
  const branchCount = summary?.branches ?? 0;
  const mainOffices = locations.filter(
    (location) => location.location_type === 'main_office',
  );
  const branches = locations.filter(
    (location) => location.location_type === 'branch',
  );
  const hasBranchesPendingSetup = branches.some((branch) => {
    const status = branch.status?.toLowerCase();
    return (
      status === 'pending_setup' ||
      status === 'inactive' ||
      status === 'suspended'
    );
  });
  const visibleBranches = branches
    .filter((branch) => {
      const matchesSearch = branch.name
        .toLowerCase()
        .includes(branchSearch.trim().toLowerCase());
      const matchesFilter =
        branchFilter === 'all' || branch.status === branchFilter;

      return matchesSearch && matchesFilter;
    })
    .sort((first, second) => {
      if (branchSort === 'newest') {
        const secondCreatedAt =
          new Date(second.created_at ?? '').getTime() || 0;
        const firstCreatedAt = new Date(first.created_at ?? '').getTime() || 0;

        return secondCreatedAt - firstCreatedAt;
      }

      return first.name.localeCompare(second.name);
    });
  const welcomeTitle = session?.userName
    ? `Welcome to Worknest, ${session.userName} 👋`
    : 'Welcome to Worknest 👋';

  return (
    <AppLayout tenant={tenant}>
      <section className="dashboard-page" aria-labelledby="dashboard-title">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 id="dashboard-title">
              {hasNoLocations ? welcomeTitle : 'Workspace Overview'}
            </h1>
            <p>
              {hasNoLocations
                ? 'Let’s set up your workspace in 2 simple steps. Start with your main office, or create a branch account first if that fits your rollout.'
                : 'Your workspace is partially set up. Complete the next steps or continue managing your offices.'}
            </p>
          </div>
          {session && !isLoading && !hasLoadError ? (
            <div
              className="dashboard-global-actions"
              aria-label="Workspace actions"
            >
              <Link
                className="button button-primary"
                to="/dashboard/main-office"
              >
                Setup Main Office
              </Link>
              <Link
                className="button button-secondary"
                to="/dashboard/branches/new"
              >
                Setup Branch
              </Link>
            </div>
          ) : null}
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
                Setup Main Office
              </Link>
              <p>
                This is usually the best starting point for a new workspace. You
                can also create a branch account first if your setup starts at a
                branch location.
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
          <div className="dashboard-overview-grid">
            <div className="dashboard-main-column">
              <section
                className="dashboard-location-strip"
                aria-labelledby="locations-title"
              >
                <div className="dashboard-section-heading">
                  <p className="eyebrow">Locations</p>
                  <h2 id="locations-title">Workspace Locations</h2>
                  <span>Manage your company structure in one place</span>
                </div>

                <div className="dashboard-location-stack">
                  <div className="dashboard-entity-section">
                    <div className="dashboard-entity-heading">
                      <span>Main Office</span>
                      {mainOffices.length === 0 ? (
                        <Link
                          className="button button-primary dashboard-location-action"
                          to="/dashboard/main-office"
                        >
                          Setup Main Office
                        </Link>
                      ) : null}
                    </div>

                    {mainOffices.length > 0
                      ? mainOffices.map((office) => (
                          <div
                            className="dashboard-location-box is-main"
                            key={office.id}
                          >
                            <div>
                              <div className="dashboard-location-box-heading">
                                <span>Main Office</span>
                                <strong>{office.name}</strong>
                              </div>
                              <div className="dashboard-card-meta">
                                <span className="dashboard-card-meta-item dashboard-card-meta-plan">
                                  Growth Plan
                                </span>
                                <span
                                  className="status-pill"
                                  title={getStatusMeta(office.status).tooltip}
                                >
                                  <span
                                    className="status-pill-dot"
                                    style={{ background: getStatusMeta(office.status).dot }}
                                  />
                                  {getStatusMeta(office.status).label}
                                </span>
                                {getLocationSince(office.created_at) ? (
                                  <>
                                    <span className="dashboard-card-meta-item">
                                      Since {getLocationSince(office.created_at)}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            <div className="dashboard-location-actions">
                              <Link
                                className="button button-primary dashboard-location-action"
                                to="/dashboard/main-office"
                              >
                                Manage
                              </Link>
                              <button
                                aria-label={`More actions for ${office.name}`}
                                className="dashboard-more-button"
                                type="button"
                              >
                                ⋯
                              </button>
                            </div>
                          </div>
                        ))
                      : null}
                  </div>

                  <div className="dashboard-location-divider" />

                  <div className="dashboard-entity-section">
                    <div className="dashboard-entity-heading">
                      <span>Branches ({branchCount})</span>
                      <Link
                        className="dashboard-inline-action"
                        to="/dashboard/branches/new"
                      >
                        + Add Branch
                      </Link>
                    </div>

                    <div
                      className="dashboard-location-toolbar"
                      aria-label="Branch tools"
                    >
                      <label>
                        <span>Search</span>
                        <input
                          name="branchSearch"
                          onChange={(event) =>
                            setBranchSearch(event.target.value)
                          }
                          placeholder="Search branches"
                          type="search"
                          value={branchSearch}
                        />
                      </label>
                      <label>
                        <span>Filter</span>
                        <select
                          name="branchFilter"
                          onChange={(event) =>
                            setBranchFilter(event.target.value)
                          }
                          value={branchFilter}
                        >
                          <option value="all">All</option>
                          <option value="active">Active</option>
                        </select>
                      </label>
                      <label>
                        <span>Sort</span>
                        <select
                          name="branchSort"
                          onChange={(event) =>
                            setBranchSort(event.target.value)
                          }
                          value={branchSort}
                        >
                          <option value="name-asc">Name A-Z</option>
                          <option value="newest">Newest</option>
                        </select>
                      </label>
                    </div>

                    {visibleBranches.length > 0 ? (
                      <div className="dashboard-location-row">
                        {visibleBranches.map((branch) => (
                          <div
                            className="dashboard-location-box"
                            key={branch.id}
                          >
                            <div>
                              <div className="dashboard-location-box-heading">
                                <BranchAvatar
                                  seed={`${branch.id}:${branch.name}`}
                                />
                                <div>
                                  <strong>{branch.name}</strong>
                                </div>
                              </div>
                              <div className="dashboard-card-meta">
                                <span className="dashboard-card-meta-item dashboard-card-meta-plan">
                                  Growth Plan
                                </span>
                                <span
                                  className="status-pill"
                                  title={getStatusMeta(branch.status).tooltip}
                                >
                                  <span
                                    className="status-pill-dot"
                                    style={{ background: getStatusMeta(branch.status).dot }}
                                  />
                                  {getStatusMeta(branch.status).label}
                                </span>
                                {getLocationSince(branch.created_at) ? (
                                  <>
                                    <span className="dashboard-card-meta-item">
                                      Since {getLocationSince(branch.created_at)}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            <div className="dashboard-location-actions">
                              <Link
                                className="button button-primary dashboard-location-action"
                                to={`/dashboard/branches/${branch.id}`}
                              >
                                Manage
                              </Link>
                              <button
                                aria-label={`More actions for ${branch.name}`}
                                className="dashboard-more-button"
                                type="button"
                              >
                                ⋯
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="dashboard-branch-empty">
                        {branches.length > 0
                          ? 'No branches match your current search or filter.'
                          : 'No branches created yet.'}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <aside
              className="dashboard-side-column"
              aria-labelledby="next-actions-title"
            >
              <section className="dashboard-next-actions">
                <div className="dashboard-section-heading">
                  <p className="eyebrow">Recommended Actions</p>
                  <h2 id="next-actions-title">Next Steps</h2>
                </div>

                {mainOfficeCount > 0 ? (
                  <div className="dashboard-task is-complete">
                    <div>
                      <h3>Main office created</h3>
                      <p>
                        Required to manage branches, admins, and workspace
                        hierarchy.
                      </p>
                    </div>
                    <Link
                      className="button button-primary"
                      to="/dashboard/main-office"
                    >
                      Manage Main Office
                    </Link>
                  </div>
                ) : (
                  <div className="dashboard-task is-priority">
                    <div>
                      <h3>Create your main office</h3>
                      <p>
                        Required to manage branches, admins, and workspace
                        hierarchy.
                      </p>
                    </div>
                    <Link
                      className="button button-primary"
                      to="/dashboard/main-office"
                    >
                      Setup Main Office
                    </Link>
                  </div>
                )}

                {hasBranchesPendingSetup ? (
                  <div className="dashboard-task is-priority">
                    <div>
                      <h3>Finish branch setup</h3>
                      <p>
                        Complete setup for one or more branches so payroll and
                        employee access can activate.
                      </p>
                    </div>
                    <Link
                      className="button button-secondary"
                      to="/dashboard/branches/new"
                    >
                      Review branches
                    </Link>
                  </div>
                ) : null}

                {branchCount === 0 ? (
                  <div className="dashboard-task">
                    <div>
                      <h3>Create a branch</h3>
                      <p>
                        You can assign plans and admins as your structure grows.
                      </p>
                    </div>
                    <Link
                      className="button button-secondary"
                      to="/dashboard/branches/new"
                    >
                      Create Branch
                    </Link>
                  </div>
                ) : null}
              </section>

              <section
                className="dashboard-management"
                aria-labelledby="management-title"
              >
                <div className="dashboard-section-heading">
                  <p className="eyebrow">Management</p>
                  <h2 id="management-title">Office Management</h2>
                </div>

                <div className="dashboard-summary">
                  <div>
                    <span>Main offices</span>
                    <strong>{mainOfficeCount}</strong>
                  </div>
                  <div>
                    <span>Branches</span>
                    <strong>{branchCount}</strong>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
