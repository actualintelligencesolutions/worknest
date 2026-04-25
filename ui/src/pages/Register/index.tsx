import { FormEvent, useState } from 'react';
import { Button } from '../../components/atoms/Button';
import { Field } from '../../components/atoms/Field';
import { AppLayout } from '../../layouts/AppLayout';
import { registerCompany } from '../../services/worknestApi';
import { useTenantStore } from '../../stores/tenantStore';
import './style.scss';

type FormErrors = {
  companyName?: string;
  workspaceSlug?: string;
  adminName?: string;
  adminEmail?: string;
  adminPhone?: string;
  adminPassword?: string;
  adminConfirmPassword?: string;
  otpCode?: string;
};

type Notice = {
  kind: 'success' | 'error';
  message: string;
};

const setupSteps = ['Company', 'Admin', 'OTP'];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return /^[0-9+\-\s()]{7,20}$/.test(value);
}

function slugFromCompanyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function workspaceAddressPart(value: string) {
  return slugFromCompanyName(value).slice(0, 15);
}

function phoneNumberPart(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

function workspaceAvailability(slug: string) {
  const reserved = new Set(['admin', 'api', 'app', 'login', 'worknest']);
  if (!slug) {
    return {
      kind: 'idle',
      message: 'Pick a short company address.',
    };
  }
  if (slug.length < 3) {
    return {
      kind: 'checking',
      message: 'Checking availability...',
    };
  }
  if (reserved.has(slug)) {
    return {
      kind: 'unavailable',
      message: 'This address is already taken.',
    };
  }
  return {
    kind: 'available',
    message: 'This address is available.',
  };
}

export function RegisterPage() {
  const tenant = useTenantStore((state) => state.tenant);
  const workspaceBaseAddress =
    typeof window === 'undefined' ? 'worknest.local/' : `${window.location.origin}/`;
  const [companyName, setCompanyName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [adminTitle, setAdminTitle] = useState('Mr.');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [view, setView] = useState<'company' | 'admin' | 'otp'>('company');
  const [otpCode, setOtpCode] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const workspaceStatus = workspaceAvailability(workspaceSlug);
  const currentStepIndex = view === 'company' ? 0 : view === 'admin' ? 1 : 2;

  function validateCompany() {
    const nextErrors: FormErrors = {};
    if (!companyName.trim()) {
      nextErrors.companyName = 'Company name is required.';
    }
    if (!workspaceSlug.trim()) {
      nextErrors.workspaceSlug = 'Workspace address is required.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateAdmin() {
    const nextErrors: FormErrors = {};
    if (!adminName.trim()) {
      nextErrors.adminName = 'Admin name is required.';
    }
    if (!adminEmail.trim()) {
      nextErrors.adminEmail = 'Admin email is required.';
    } else if (!isValidEmail(adminEmail)) {
      nextErrors.adminEmail = 'Enter a valid admin email.';
    }
    if (!adminPhone.trim()) {
      nextErrors.adminPhone = 'Admin phone is required.';
    } else if (!isValidPhone(adminPhone)) {
      nextErrors.adminPhone = 'Enter a valid phone number.';
    }
    if (adminPassword.length < 8) {
      nextErrors.adminPassword = 'Password must be at least 8 characters.';
    }
    if (adminConfirmPassword !== adminPassword) {
      nextErrors.adminConfirmPassword = 'Passwords must match.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleCompanyContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCompany()) {
      return;
    }
    setView('admin');
  }

  async function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateAdmin()) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      const response = await registerCompany({
        company_name: companyName.trim(),
        tenant_id: workspaceSlug.trim(),
        admin_name: `${adminTitle} ${adminName.trim()}`.trim(),
        admin_email: adminEmail.trim(),
        admin_phone: `+91${adminPhone.trim()}`,
        admin_password: adminPassword,
      });
      setNotice({
        kind: 'success',
        message: `${response.tenant.name} is registered. Enter the OTP to continue.`,
      });
      setView('otp');
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[0-9]{4,6}$/.test(otpCode.trim())) {
      setErrors((current) => ({
        ...current,
        otpCode: 'Enter the 4 to 6 digit OTP.',
      }));
      return;
    }

    setErrors((current) => ({ ...current, otpCode: undefined }));
    setNotice({
      kind: 'success',
      message: 'OTP verified. Workspace setup is ready.',
    });
  }

  return (
    <AppLayout tenant={tenant}>
      <div className="register-page-shell">
        <section className="register-page" aria-labelledby="register-title">
          <div className="register-visual">
            <div className="register-intro">
              <h1 id="register-title">
                Let&apos;s set up your company workspace
              </h1>
              <p>
                Start with your company profile and primary admin. The rest of
                the workspace can be configured after verification.
              </p>
            </div>
          </div>

          <div className="register-form-area">
            {notice ? (
              <div className={`register-notice ${notice.kind}`} role="status">
                {notice.message}
              </div>
            ) : null}

            <div className="register-panel">
            {view === 'company' ? (
              <form className="company-form" onSubmit={handleCompanyContinue}>
                <div className="panel-heading">
                  <ol className="register-stepper" aria-label="Registration progress">
                    {setupSteps.map((step, index) => (
                      <li
                        className={index <= currentStepIndex ? 'active' : ''}
                        key={step}
                      >
                        <span>{index + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <h2>Company details</h2>
                </div>

                <Field label="Company name" error={errors.companyName}>
                  <div className="company-name-control">
                    <span>M/s</span>
                    <input
                      autoComplete="organization"
                      name="companyName"
                      onChange={(event) => {
                        setCompanyName(event.target.value);
                        setErrors((current) => ({
                          ...current,
                          companyName: undefined,
                        }));
                      }}
                      onBlur={() => {
                        setWorkspaceSlug(workspaceAddressPart(companyName));
                        setErrors((current) => ({
                          ...current,
                          workspaceSlug: undefined,
                        }));
                      }}
                      placeholder="Example Private Limited"
                      value={companyName}
                    />
                  </div>
                </Field>

                <Field label="Workspace address" error={errors.workspaceSlug}>
                  <div className="workspace-address-control">
                    <span>{workspaceBaseAddress}</span>
                    <input
                      autoComplete="off"
                      name="workspaceSlug"
                      onChange={(event) => {
                        setWorkspaceSlug(
                          workspaceAddressPart(event.target.value),
                        );
                        setErrors((current) => ({
                          ...current,
                          workspaceSlug: undefined,
                        }));
                      }}
                      placeholder="acme"
                      value={workspaceSlug}
                    />
                  </div>
                  {!errors.workspaceSlug ? (
                    <span
                      className={`workspace-availability ${workspaceStatus.kind}`}
                    >
                      {workspaceStatus.message}
                    </span>
                  ) : null}
                </Field>

                <div className="register-actions">
                  <Button type="submit">Continue</Button>
                </div>
              </form>
            ) : null}

            {view === 'admin' ? (
              <form className="admin-form" onSubmit={handleCreateCompany}>
                <div className="panel-heading">
                  <ol className="register-stepper" aria-label="Registration progress">
                    {setupSteps.map((step, index) => (
                      <li
                        className={index <= currentStepIndex ? 'active' : ''}
                        key={step}
                      >
                        <span>{index + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <h2>Admin details</h2>
                </div>

                <Field label="Admin name" error={errors.adminName}>
                  <div className="admin-name-control">
                    <select
                      aria-label="Admin title"
                      name="adminTitle"
                      onChange={(event) => setAdminTitle(event.target.value)}
                      value={adminTitle}
                    >
                      <option>Mr.</option>
                      <option>Mrs.</option>
                      <option>Ms.</option>
                      <option>Dr.</option>
                      <option>Mx.</option>
                    </select>
                    <input
                      autoComplete="name"
                      name="adminName"
                      onChange={(event) => {
                        setAdminName(event.target.value);
                        setErrors((current) => ({
                          ...current,
                          adminName: undefined,
                        }));
                      }}
                      placeholder="Priya Sharma"
                      value={adminName}
                    />
                  </div>
                </Field>

                <Field label="Admin email" error={errors.adminEmail}>
                  <input
                    autoComplete="email"
                    name="adminEmail"
                    onChange={(event) => {
                      setAdminEmail(event.target.value);
                      setErrors((current) => ({
                        ...current,
                        adminEmail: undefined,
                      }));
                    }}
                    placeholder="admin@example.com"
                    type="email"
                    value={adminEmail}
                  />
                </Field>

                <Field label="Admin phone" error={errors.adminPhone}>
                  <div className="phone-number-control">
                    <span>+91</span>
                    <input
                      autoComplete="tel"
                      inputMode="numeric"
                      name="adminPhone"
                      onChange={(event) => {
                        setAdminPhone(phoneNumberPart(event.target.value));
                        setErrors((current) => ({
                          ...current,
                          adminPhone: undefined,
                        }));
                      }}
                      placeholder="9876543210"
                      value={adminPhone}
                    />
                  </div>
                </Field>

                <div className="register-divider" />

                <Field label="Admin password" error={errors.adminPassword}>
                  <input
                    autoComplete="new-password"
                    name="adminPassword"
                    onChange={(event) => {
                      setAdminPassword(event.target.value);
                      setErrors((current) => ({
                        ...current,
                        adminPassword: undefined,
                      }));
                    }}
                    placeholder="Minimum 8 characters"
                    type="password"
                    value={adminPassword}
                  />
                </Field>

                <Field
                  label="Confirm admin password"
                  error={errors.adminConfirmPassword}
                >
                  <input
                    autoComplete="new-password"
                    name="adminConfirmPassword"
                    onChange={(event) => {
                      setAdminConfirmPassword(event.target.value);
                      setErrors((current) => ({
                        ...current,
                        adminConfirmPassword: undefined,
                      }));
                    }}
                    placeholder="Re-enter password"
                    type="password"
                    value={adminConfirmPassword}
                  />
                </Field>

                <div className="register-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setView('company')}
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Continuing...' : 'Continue'}
                  </Button>
                </div>
              </form>
            ) : null}

            {view === 'otp' ? (
              <form className="otp-form" onSubmit={handleVerifyOtp}>
                <div className="panel-heading">
                  <ol className="register-stepper" aria-label="Registration progress">
                    {setupSteps.map((step, index) => (
                      <li
                        className={index <= currentStepIndex ? 'active' : ''}
                        key={step}
                      >
                        <span>{index + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <h2>Enter OTP</h2>
                  <p>
                    We sent a verification code to {adminPhone || adminEmail}.
                  </p>
                </div>

                <Field label="OTP code" error={errors.otpCode}>
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    name="otpCode"
                    onChange={(event) => {
                      setOtpCode(event.target.value.replace(/\D/g, ''));
                      setErrors((current) => ({
                        ...current,
                        otpCode: undefined,
                      }));
                    }}
                    placeholder="Enter OTP"
                    value={otpCode}
                  />
                </Field>

                <p className="register-next">
                  Verify the admin account to continue with workspace setup.
                </p>

                <div className="register-actions">
                  <Button type="submit">Verify OTP</Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setView('admin')}
                  >
                    Edit details
                  </Button>
                </div>
              </form>
            ) : null}
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
