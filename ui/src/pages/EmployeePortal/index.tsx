import { useEffect, useState } from 'react';
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

const employeeDocumentSections = [
  {
    key: 'payslips',
    label: 'Payslips',
    state: 'active' as const,
  },
  {
    key: 'letters',
    label: 'Letters',
    state: 'soon' as const,
  },
];

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
  const [phone, setPhone] = useState('');
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

    if (!phone.trim() || !pin.trim()) {
      setError('Phone number and PIN are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await loginEmployeeForSite(tenantId, officeCode, {
        phone: phone.trim(),
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
    <MarketingLayout withoutHeader>
      <section className="employee-portal-auth">
        <div className="employee-portal-auth-card">
          <p className="employee-portal-kicker">Employee documents</p>
          <h1>{siteQuery.data?.site.name ?? 'Employee site access'}</h1>
          <p className="employee-portal-copy">
            {siteQuery.isError
              ? 'This site URL is not valid. Check the link shared by your payroll team.'
              : 'Sign in with your phone number and PIN to access your documents on this site.'}
          </p>

          {siteQuery.data?.site ? (
            <div className="employee-portal-site-meta employee-portal-site-meta-auth">
              <div>
                <span>{siteQuery.data.site.office_code}</span>
                <strong>{siteQuery.data.site.name}</strong>
              </div>
              <p>
                {[siteQuery.data.site.city, siteQuery.data.site.state].filter(Boolean).join(', ') || 'Employee document portal'}
              </p>
            </div>
          ) : null}

          <form className="employee-portal-form" onSubmit={handleSubmit}>
            <label>
              <span>Phone number</span>
              <input
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter phone number"
                type="tel"
                value={phone}
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

            <button className="marketing-login-submit employee-portal-primary-action" disabled={isSubmitting || siteQuery.isError} type="submit">
              {isSubmitting ? 'Signing in...' : 'Open documents'}
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
  const [selectedPayslipId, setSelectedPayslipId] = useState<number | null>(null);

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
  const payslips = payslipsQuery.data?.payslips ?? [];
  const selectedPayslip = payslips.find((item) => item.id === selectedPayslipId) ?? payslips[0] ?? null;

  useEffect(() => {
    if (payslips.length === 0) {
      if (selectedPayslipId !== null) {
        setSelectedPayslipId(null);
      }
      return;
    }

    if (selectedPayslipId === null || !payslips.some((item) => item.id === selectedPayslipId)) {
      setSelectedPayslipId(payslips[0].id);
    }
  }, [payslips, selectedPayslipId]);

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
      <MarketingLayout withoutHeader>
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
    <MarketingLayout withoutHeader>
      <section className="employee-portal-page">
        <div className="employee-portal-page-head">
          <div className="employee-portal-page-copy">
            <p className="employee-portal-kicker">Employee documents</p>
            <h1>{session.userName ?? 'Your documents'}</h1>
            <p className="employee-portal-copy">
              View and download any published payslips available for you on this site.
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

        <div className="employee-portal-wallet">
          <div className="employee-portal-wallet-card employee-portal-wallet-card-site">
            <span className="employee-portal-wallet-label">Site</span>
            <strong>{siteQuery.data?.site.name ?? 'Employee portal'}</strong>
            <p>{siteQuery.data?.site.office_code ?? officeCode.toUpperCase()}</p>
          </div>
          <div className="employee-portal-wallet-card">
            <span className="employee-portal-wallet-label">Portal access</span>
            <strong>Secure mobile access</strong>
            <p>{[siteQuery.data?.site.city, siteQuery.data?.site.state].filter(Boolean).join(', ') || 'Published documents only'}</p>
          </div>
        </div>

        <section className="employee-portal-documents">
          <div className="employee-portal-documents-head">
            <div>
              <p className="employee-portal-kicker">Documents</p>
              <h2>Available sections</h2>
            </div>
            <div className="employee-portal-section-tabs" aria-label="Employee document sections">
              {employeeDocumentSections.map((section) => (
                <span
                  className={
                    section.state === 'active'
                      ? 'employee-portal-section-tab is-active'
                      : 'employee-portal-section-tab'
                  }
                  key={section.key}
                >
                  {section.label}
                  {section.state === 'soon' ? ' Soon' : ''}
                </span>
              ))}
            </div>
          </div>

          {downloadError ? <p className="employee-portal-error">{downloadError}</p> : null}

          <div className="employee-portal-list">
            {payslips.length === 0 ? (
              <div className="employee-portal-empty">
                <h3>No published payslips yet</h3>
                <p>Your payroll team has not published any payslips for this account yet.</p>
              </div>
            ) : (
              <article className="employee-portal-card employee-portal-card-selector">
                <div className="employee-portal-card-copy">
                  <p className="employee-portal-card-kicker">Selected payslip</p>
                  <h3>{selectedPayslip?.employee_name_snapshot ?? session.userName ?? 'Payslip'}</h3>
                  <label className="employee-portal-select-field">
                    <span>Select month</span>
                    <select
                      onChange={(event) => {
                        setSelectedPayslipId(Number(event.target.value));
                      }}
                      value={selectedPayslip?.id ?? ''}
                    >
                      {payslips.map((payslip) => (
                        <option key={payslip.id} value={payslip.id}>
                          {formatMonth(payslip.period_year, payslip.period_month)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedPayslip ? (
                    <div className="employee-portal-card-metrics">
                      <div>
                        <span>Net pay</span>
                        <strong>{formatMoney(selectedPayslip.net_pay)}</strong>
                      </div>
                      <div>
                        <span>Status</span>
                        <strong>{selectedPayslip.status}</strong>
                      </div>
                    </div>
                  ) : null}
                </div>
                <Button
                  disabled={!selectedPayslip || downloadingId === selectedPayslip.id}
                  onClick={() => {
                    if (!selectedPayslip) {
                      return;
                    }

                    const label = `${selectedPayslip.period_year}-${String(selectedPayslip.period_month).padStart(2, '0')}-${selectedPayslip.employee_id ?? 'payslip'}`;
                    void handleDownload(selectedPayslip.id, label);
                  }}
                  type="button"
                >
                  {selectedPayslip && downloadingId === selectedPayslip.id ? 'Preparing...' : 'Download'}
                </Button>
              </article>
            )}
          </div>
        </section>
      </section>
    </MarketingLayout>
  );
}
