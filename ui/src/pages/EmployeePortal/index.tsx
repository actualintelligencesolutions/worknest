import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { MarketingLayout } from '../../layouts/MarketingLayout';
import { clearEmployeeSession, loadEmployeeSession, saveEmployeeSession } from '../../services/employeeSession';
import {
  downloadPayslip,
  getSitePortal,
  listPayslips,
  loginEmployeeForSite,
} from '../../services/worknestApi';
import './style.scss';

function formatMonth(periodYear: number, periodMonth: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(periodYear, periodMonth - 1, 1));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

export function EmployeeLoginPage() {
  const navigate = useNavigate();
  const { tenantId = '', officeCode = '' } = useParams();
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const siteQuery = useQuery({
    queryKey: ['employee-site-portal', tenantId, officeCode],
    queryFn: () => getSitePortal(tenantId, officeCode),
    enabled: tenantId !== '' && officeCode !== '',
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!identifier.trim() || !pin.trim()) {
      setError('Employee ID and PIN are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await loginEmployeeForSite(tenantId, officeCode, {
        identifier: identifier.trim(),
        pin: pin.trim(),
      });

      saveEmployeeSession({
        token: response.session.token,
        tenantId: response.tenant.tenant_id,
        userName: response.actor.name,
        userType: 'employee',
      });

      navigate(`/site/${tenantId}/${officeCode}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to sign in to the site portal.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MarketingLayout>
      <section className="employee-portal-auth">
        <div className="employee-portal-auth-card">
          <p className="employee-portal-kicker">Site Payslip Portal</p>
          <h1>{siteQuery.data?.site.name ?? 'Employee site access'}</h1>
          <p className="employee-portal-copy">
            {siteQuery.isError
              ? 'This site URL is not valid. Check the link shared by your payroll team.'
              : 'Sign in with your employee ID and PIN to access published payslips for this site.'}
          </p>

          {siteQuery.data?.site ? (
            <div className="employee-portal-site-meta">
              <span>{siteQuery.data.site.office_code}</span>
              <strong>
                {[siteQuery.data.site.city, siteQuery.data.site.state].filter(Boolean).join(', ') || 'Worknest site portal'}
              </strong>
            </div>
          ) : null}

          <form className="employee-portal-form" onSubmit={handleSubmit}>
            <label>
              <span>Employee ID</span>
              <input
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Enter employee ID"
                type="text"
                value={identifier}
              />
            </label>

            <label>
              <span>PIN</span>
              <input
                onChange={(event) => setPin(event.target.value)}
                placeholder="Enter PIN"
                type="password"
                value={pin}
              />
            </label>

            {error ? <p className="employee-portal-error">{error}</p> : null}

            <button className="marketing-login-submit" disabled={isSubmitting || siteQuery.isError} type="submit">
              {isSubmitting ? 'Signing in...' : 'Access payslips'}
            </button>
          </form>

          <p className="employee-portal-note">
            Admin sign-in? <Link to={`/login/${tenantId}`}>Open company login</Link>
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}

export function EmployeePortalPage() {
  const navigate = useNavigate();
  const { tenantId = '', officeCode = '' } = useParams();
  const session = loadEmployeeSession();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const siteQuery = useQuery({
    queryKey: ['employee-site-portal', tenantId, officeCode],
    queryFn: () => getSitePortal(tenantId, officeCode),
    enabled: tenantId !== '' && officeCode !== '',
  });

  const payslipsQuery = useQuery({
    queryKey: ['employee-payslips', session?.tenantId],
    queryFn: () => listPayslips(session!),
    enabled: Boolean(session && session.tenantId === tenantId),
  });

  const lacksSession = !session || session.tenantId !== tenantId;

  async function handleDownload(payslipId: number, fileLabel: string) {
    if (!session) {
      return;
    }

    try {
      setDownloadingId(payslipId);
      setDownloadError(null);
      await downloadPayslip(session, payslipId, `${fileLabel}.pdf`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Unable to download payslip.');
    } finally {
      setDownloadingId(null);
    }
  }

  if (lacksSession) {
    return (
      <MarketingLayout>
        <section className="employee-portal-auth">
          <div className="employee-portal-auth-card">
            <p className="employee-portal-kicker">Site Payslip Portal</p>
            <h1>{siteQuery.data?.site.name ?? 'Employee portal'}</h1>
            <p className="employee-portal-copy">
              Sign in first to view payslips for this site.
            </p>
            <Button as={Link} to={`/site/${tenantId}/${officeCode}/login`}>
              Sign in to site portal
            </Button>
          </div>
        </section>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <section className="employee-portal-page">
        <div className="employee-portal-page-head">
          <div>
            <p className="employee-portal-kicker">Employee portal</p>
            <h1>{siteQuery.data?.site.name ?? 'Your payslips'}</h1>
            <p className="employee-portal-copy">
              View and download published payslips for this site.
            </p>
          </div>
          <Button
            onClick={() => {
              clearEmployeeSession();
              navigate(`/site/${tenantId}/${officeCode}/login`);
            }}
            type="button"
            variant="secondary"
          >
            Sign out
          </Button>
        </div>

        {siteQuery.data?.site ? (
          <div className="employee-portal-site-meta employee-portal-site-meta-inline">
            <span>{siteQuery.data.site.office_code}</span>
            <strong>
              {[siteQuery.data.site.city, siteQuery.data.site.state].filter(Boolean).join(', ') || 'Worknest site portal'}
            </strong>
          </div>
        ) : null}

        {downloadError ? <p className="employee-portal-error">{downloadError}</p> : null}

        <div className="employee-portal-list">
          {(payslipsQuery.data?.payslips ?? []).length === 0 ? (
            <div className="employee-portal-empty">
              <h2>No published payslips yet</h2>
              <p>Your payroll team has not published any payslips for this account yet.</p>
            </div>
          ) : (
            (payslipsQuery.data?.payslips ?? []).map((payslip) => {
              const label = `${payslip.period_year}-${String(payslip.period_month).padStart(2, '0')}-${payslip.employee_id ?? 'payslip'}`;

              return (
                <article className="employee-portal-card" key={payslip.id}>
                  <div>
                    <p className="employee-portal-card-kicker">{formatMonth(payslip.period_year, payslip.period_month)}</p>
                    <h2>{payslip.employee_name_snapshot ?? session.userName ?? 'Payslip'}</h2>
                    <p className="employee-portal-card-meta">
                      Net pay {formatMoney(payslip.net_pay)}
                    </p>
                  </div>
                  <Button
                    disabled={downloadingId === payslip.id}
                    onClick={() => {
                      void handleDownload(payslip.id, label);
                    }}
                    type="button"
                  >
                    {downloadingId === payslip.id ? 'Preparing...' : 'Download PDF'}
                  </Button>
                </article>
              );
            })
          )}
        </div>
      </section>
    </MarketingLayout>
  );
}
