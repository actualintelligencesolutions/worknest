import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppLayout } from '../../layouts/AppLayout';
import { loadHrSession } from '../../services/hrSession';
import {
  getBranch,
  type AuthSession,
  type BranchDetail,
} from '../../services/worknestApi';
import { useTenantStore } from '../../stores/tenantStore';
import './location-setup.scss';

function statusLabel(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'Active';
    case 'trial':
      return 'Trial';
    case 'expired':
      return 'Expired';
    case 'pending_setup':
      return 'Pending Setup';
    default:
      return status ?? '—';
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', { dateStyle: 'medium' });
}

function formatPlan(branch: BranchDetail): string {
  if (!branch.plan.name) return 'No plan assigned';
  if (branch.plan.price_cents !== null && branch.plan.currency) {
    const amount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: branch.plan.currency,
      maximumFractionDigits: 0,
    }).format(branch.plan.price_cents / 100);
    return `${branch.plan.name} — ${amount}`;
  }
  return branch.plan.name;
}

export function ManageBranchPage() {
  const { id } = useParams<{ id: string }>();
  const tenant = useTenantStore((state) => state.tenant);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageTitle(branch?.location.name ?? 'Manage Branch');

  useEffect(() => {
    const storedSession = loadHrSession();
    setSession(storedSession);

    if (!storedSession || !id) {
      setIsLoading(false);
      return;
    }

    const branchId = parseInt(id, 10);
    if (isNaN(branchId)) {
      setError('Invalid branch identifier.');
      setIsLoading(false);
      return;
    }

    let isCurrent = true;

    async function loadBranch() {
      try {
        const response = await getBranch(storedSession!, branchId);
        if (!isCurrent) return;
        setBranch(response);
      } catch (err) {
        if (!isCurrent) return;
        setError((err as Error).message);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadBranch();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  return (
    <AppLayout tenant={tenant}>
      <section
        className="location-setup-page"
        aria-labelledby="manage-branch-title"
      >
        <div className="location-setup-heading">
          <p className="eyebrow">Branch Management</p>
          <h1 id="manage-branch-title">
            {branch?.location.name ?? 'Manage Branch'}
          </h1>
          <p>View and manage the details for this branch.</p>
        </div>

        <Link
          className="button button-ghost location-back-action"
          to="/dashboard"
        >
          ← Back to Dashboard
        </Link>

        {error ? (
          <div className="location-setup-notice error" role="alert">
            {error}
          </div>
        ) : null}

        {!session ? (
          <div className="location-setup-session">
            <strong>Session required</strong>
            <p>You must be logged in to manage a branch.</p>
            <Link className="button button-secondary" to="/register">
              Go to registration
            </Link>
          </div>
        ) : null}

        {isLoading ? <div className="dashboard-loading">Loading…</div> : null}

        {!isLoading && !error && branch !== null ? (
          <div className="location-setup-shell">
            <div className="location-setup-card">
              <dl className="location-preview" style={{ border: 'none', boxShadow: 'none', padding: 0 }}>
                <div>
                  <dt>Branch Name</dt>
                  <dd>{branch.location.name}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{statusLabel(branch.location.status)}</dd>
                </div>
                <div>
                  <dt>Plan</dt>
                  <dd>{formatPlan(branch)}</dd>
                </div>
                <div>
                  <dt>Admin</dt>
                  <dd>
                    {branch.admin.name ?? 'No admin assigned'}
                    {branch.admin.email ? ` — ${branch.admin.email}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Admin Status</dt>
                  <dd>{branch.admin.status ?? '—'}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(branch.location.created_at)}</dd>
                </div>
              </dl>
            </div>

            <aside className="location-preview" aria-label="Branch summary">
              <span>Branch</span>
              <strong>{branch.location.name}</strong>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{statusLabel(branch.location.status)}</dd>
                </div>
                <div>
                  <dt>Plan</dt>
                  <dd>{branch.plan.name ?? '—'}</dd>
                </div>
                <div>
                  <dt>Admin</dt>
                  <dd>{branch.admin.name ?? '—'}</dd>
                </div>
              </dl>
            </aside>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
