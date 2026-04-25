import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '../../../layouts/AppLayout';
import { useTenantStore } from '../../../stores/tenantStore';
import {
  createPayrollPeriod,
  downloadPayslip,
  listPayslips,
  processImport,
  publishPeriod,
  registerCompany,
  requestEmployeeOtp,
  saveImportMapping,
  uploadPayrollImport,
  verifyEmployeeOtp,
  type AuthSession,
  type PayrollImportResponse,
  type Payslip,
} from '../../../services/worknestApi';
import './style.scss';

const payrollFields = [
  'employee_code',
  'employee_name',
  'phone',
  'basic',
  'hra',
  'allowances',
  'gross_pay',
  'pf',
  'esi',
  'professional_tax',
  'tds',
  'total_deductions',
  'net_pay',
];

type Notice = {
  kind: 'success' | 'error' | 'info';
  message: string;
};

export function WorknestPage() {
  const { t } = useTranslation();
  const tenant = useTenantStore((state) => state.tenant);
  const [hrSession, setHrSession] = useState<AuthSession | null>(null);
  const [employeeSession, setEmployeeSession] = useState<AuthSession | null>(
    null,
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [payrollImport, setPayrollImport] =
    useState<PayrollImportResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<{
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    critical_errors: string[];
  } | null>(null);
  const [employeeTenant, setEmployeeTenant] = useState('default');
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [devOtp, setDevOtp] = useState('');
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  useEffect(() => {
    if (!payrollImport) {
      return;
    }
    const suggested = Object.fromEntries(
      Object.entries(payrollImport.mapping_suggestions).map(
        ([field, value]) => [field, value.source],
      ),
    );
    setMapping(suggested);
  }, [payrollImport]);

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await registerCompany({
        company_name: String(form.get('company_name') ?? ''),
        tenant_id: String(form.get('tenant_id') ?? ''),
        admin_name: String(form.get('admin_name') ?? ''),
        admin_email: String(form.get('admin_email') ?? ''),
        admin_phone: String(form.get('admin_phone') ?? ''),
        admin_password: String(form.get('admin_password') ?? ''),
      });
      if (response.token) {
        setHrSession({
          token: response.token,
          tenantId: response.tenant.tenant_id,
        });
      }
      setEmployeeTenant(response.tenant.tenant_id);
      setNotice({
        kind: 'success',
        message: response.verification
          ? `Workspace created. Verify the email OTP sent to ${response.verification.destination}.`
          : t('notices.workspaceCreated'),
      });
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hrSession) {
      setNotice({ kind: 'error', message: t('notices.hrRequired') });
      return;
    }
    const form = new FormData(event.currentTarget);
    const file = form.get('payroll_file');
    if (!(file instanceof File) || file.size === 0) {
      setNotice({ kind: 'error', message: t('notices.fileRequired') });
      return;
    }
    try {
      const period = await createPayrollPeriod(hrSession, {
        period_month: Number(form.get('period_month')),
        period_year: Number(form.get('period_year')),
      });
      setPeriodId(period.period.id);
      const upload = await uploadPayrollImport(
        hrSession,
        period.period.id,
        file,
      );
      setPayrollImport(upload);
      setSummary(null);
      setNotice({ kind: 'success', message: t('notices.uploadReady') });
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    }
  }

  async function handleProcess() {
    if (!hrSession || !payrollImport) {
      return;
    }
    try {
      await saveImportMapping(hrSession, payrollImport.import.id, mapping);
      const processed = await processImport(hrSession, payrollImport.import.id);
      setSummary(processed.summary);
      setNotice({ kind: 'success', message: t('notices.importProcessed') });
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    }
  }

  async function handlePublish() {
    if (!hrSession || periodId === null) {
      return;
    }
    try {
      const published = await publishPeriod(hrSession, periodId);
      setNotice({
        kind: 'success',
        message: t('notices.periodPublished', {
          count: published.generated_files,
        }),
      });
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    }
  }

  async function handleOtpRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await requestEmployeeOtp(
        employeeTenant,
        String(form.get('phone') ?? ''),
      );
      setChallengeId(response.challenge_id);
      setDevOtp(response.dev_otp);
      setNotice({ kind: 'info', message: t('notices.otpCreated') });
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    }
  }

  async function handleOtpVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (challengeId === null) {
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      const verified = await verifyEmployeeOtp(
        employeeTenant,
        challengeId,
        String(form.get('otp_code') ?? ''),
      );
      const session = { token: verified.token, tenantId: employeeTenant };
      setEmployeeSession(session);
      const response = await listPayslips(session);
      setPayslips(response.payslips);
      setNotice({ kind: 'success', message: t('notices.employeeVerified') });
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    }
  }

  async function handleDownload(payslipId: number) {
    if (!employeeSession) {
      return;
    }
    try {
      const blob = await downloadPayslip(employeeSession, payslipId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `worknest-payslip-${payslipId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    }
  }

  return (
    <AppLayout tenant={tenant}>
      <section className="worknest-hero">
        <div>
          <p className="eyebrow">{t('pages.workspace.eyebrow')}</p>
          <h2>{t('pages.workspace.title')}</h2>
          <p>{t('pages.workspace.description')}</p>
        </div>
        <div className="activation-card">
          <span>{t('pages.workspace.activationLabel')}</span>
          <strong>{t('pages.workspace.activationValue')}</strong>
        </div>
      </section>

      {notice ? (
        <div className={`notice ${notice.kind}`} role="status">
          {notice.message}
        </div>
      ) : null}

      <section className="worknest-grid">
        <form className="panel" onSubmit={handleRegistration}>
          <div className="panel-heading">
            <p className="eyebrow">{t('pages.workspace.registration.step')}</p>
            <h3>{t('pages.workspace.registration.title')}</h3>
          </div>
          <label>
            {t('fields.companyName')}
            <input name="company_name" required />
          </label>
          <label>
            {t('fields.tenantSlug')}
            <input
              name="tenant_id"
              placeholder={t('fields.tenantSlugPlaceholder')}
            />
          </label>
          <label>
            {t('fields.adminName')}
            <input name="admin_name" required />
          </label>
          <label>
            {t('fields.adminEmail')}
            <input name="admin_email" type="email" required />
          </label>
          <label>
            {t('fields.adminPhone')}
            <input name="admin_phone" required />
          </label>
          <label>
            {t('fields.adminPassword')}
            <input
              name="admin_password"
              type="password"
              minLength={8}
              required
            />
          </label>
          <button className="primary-action" type="submit">
            {t('pages.workspace.registration.createWorkspace')}
          </button>
        </form>

        <form className="panel" onSubmit={handleUpload}>
          <div className="panel-heading">
            <p className="eyebrow">{t('pages.workspace.payroll.step')}</p>
            <h3>{t('pages.workspace.payroll.title')}</h3>
          </div>
          <div className="inline-fields">
            <label>
              {t('fields.month')}
              <input
                name="period_month"
                type="number"
                min={1}
                max={12}
                required
              />
            </label>
            <label>
              {t('fields.year')}
              <input name="period_year" type="number" min={2000} required />
            </label>
          </div>
          <label>
            {t('fields.payrollFile')}
            <input
              name="payroll_file"
              type="file"
              accept=".csv,.xlsx"
              required
            />
          </label>
          <button
            className="primary-action"
            type="submit"
            disabled={!hrSession}
          >
            {t('pages.workspace.payroll.upload')}
          </button>
        </form>
      </section>

      {payrollImport ? (
        <section className="panel mapping-panel">
          <div className="panel-heading">
            <p className="eyebrow">{t('pages.workspace.mapping.step')}</p>
            <h3>{t('pages.workspace.mapping.title')}</h3>
          </div>
          <div className="mapping-grid">
            {payrollFields.map((field) => (
              <label key={field}>
                {t(`payrollFields.${field}`)}
                <select
                  value={mapping[field] ?? ''}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                >
                  <option value="">{t('fields.notMapped')}</option>
                  {payrollImport.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={handleProcess}
          >
            {t('pages.workspace.mapping.process')}
          </button>
        </section>
      ) : null}

      {summary ? (
        <section className="panel review-panel">
          <div className="panel-heading">
            <p className="eyebrow">{t('pages.workspace.review.step')}</p>
            <h3>{t('pages.workspace.review.title')}</h3>
          </div>
          <div className="metrics">
            <span>
              {t('pages.workspace.review.totalRows')}
              <strong>{summary.total_rows}</strong>
            </span>
            <span>
              {t('pages.workspace.review.validRows')}
              <strong>{summary.valid_rows}</strong>
            </span>
            <span>
              {t('pages.workspace.review.errorRows')}
              <strong>{summary.error_rows}</strong>
            </span>
          </div>
          {summary.critical_errors.length > 0 ? (
            <ul className="exception-list">
              {summary.critical_errors.slice(0, 8).map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          ) : null}
          <button
            className="primary-action"
            type="button"
            onClick={handlePublish}
            disabled={summary.error_rows > 0}
          >
            {t('pages.workspace.review.publish')}
          </button>
        </section>
      ) : null}

      <section className="panel employee-panel">
        <div className="panel-heading">
          <p className="eyebrow">{t('pages.workspace.employee.step')}</p>
          <h3>{t('pages.workspace.employee.title')}</h3>
        </div>
        <form className="employee-login" onSubmit={handleOtpRequest}>
          <label>
            {t('fields.employeeTenant')}
            <input
              value={employeeTenant}
              onChange={(event) => setEmployeeTenant(event.target.value)}
            />
          </label>
          <label>
            {t('fields.employeePhone')}
            <input name="phone" required />
          </label>
          <button className="secondary-action" type="submit">
            {t('pages.workspace.employee.requestOtp')}
          </button>
        </form>
        {challengeId ? (
          <form className="employee-login" onSubmit={handleOtpVerify}>
            <label>
              {t('fields.otpCode')}
              <input name="otp_code" defaultValue={devOtp} required />
            </label>
            <button className="primary-action" type="submit">
              {t('pages.workspace.employee.verifyOtp')}
            </button>
          </form>
        ) : null}
        {employeeSession ? (
          <div className="payslip-list">
            {payslips.length === 0 ? (
              <p className="muted">{t('pages.workspace.employee.empty')}</p>
            ) : (
              payslips.map((payslip) => (
                <button
                  key={payslip.id}
                  className="payslip-download"
                  type="button"
                  onClick={() => handleDownload(payslip.id)}
                >
                  {payslip.period_month}/{payslip.period_year} -{' '}
                  {payslip.employee_name}
                </button>
              ))
            )}
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
