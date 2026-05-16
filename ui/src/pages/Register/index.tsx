import { useEffect, useMemo, useState } from 'react';
import { MarketingLayout } from '../../layouts/MarketingLayout';
import {
  checkWorkspaceSlug,
  registerCompany,
  type RegistrationResult,
} from '../../services/worknestApi';
import './style.scss';

type Phase = 1 | 2;

export function RegisterPage() {
  const [phase, setPhase] = useState<Phase>(1);
  const [companyName, setCompanyName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [hasEditedWorkspace, setHasEditedWorkspace] = useState(false);
  const [fullName, setFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<RegistrationResult | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<{
    state: 'idle' | 'checking' | 'available' | 'taken';
    message: string | null;
  }>({
    state: 'idle',
    message: null,
  });

  const normalizedWorkspace = useMemo(() => slugify(workspaceSlug), [workspaceSlug]);

  useEffect(() => {
    if (!hasEditedWorkspace) {
      setWorkspaceSlug(slugify(companyName));
    }
  }, [companyName, hasEditedWorkspace]);

  async function handlePhaseOneContinue() {
    setError(null);

    if (!companyName.trim() || !normalizedWorkspace) {
      setError('Company name and workspace are required.');
      return;
    }

    const available = await verifyWorkspace(normalizedWorkspace);
    if (!available) {
      return;
    }

    setPhase(2);
  }

  async function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (
      !companyName.trim() ||
      !normalizedWorkspace ||
      !fullName.trim() ||
      !adminEmail.trim() ||
      !adminPhone.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError('Complete all required fields before creating the workspace.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      const available = await verifyWorkspace(normalizedWorkspace);
      if (!available) {
        setIsSubmitting(false);
        return;
      }

      const response = await registerCompany({
        company_name: companyName.trim(),
        tenant_id: normalizedWorkspace,
        admin_name: fullName.trim(),
        admin_email: adminEmail.trim(),
        admin_phone: adminPhone.trim(),
        admin_password: password,
      });
      setSuccess(response);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to register the company.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyWorkspace(candidate: string) {
    try {
      setWorkspaceStatus({ state: 'checking', message: 'Checking workspace availability...' });
      const result = await checkWorkspaceSlug(candidate);
      if (!result.available) {
        setWorkspaceStatus({
          state: 'taken',
          message:
            result.reason === 'reserved'
              ? 'This workspace is reserved. Try a different slug.'
              : 'This workspace is already taken.',
        });
        setError('Choose a different workspace slug.');
        return false;
      }

      setWorkspaceStatus({
        state: 'available',
        message: `Workspace ${candidate} is available.`,
      });
      return true;
    } catch (workspaceError) {
      setWorkspaceStatus({
        state: 'taken',
        message:
          workspaceError instanceof Error
            ? workspaceError.message
            : 'Could not verify the workspace right now.',
      });
      setError('Unable to verify workspace availability right now.');
      return false;
    }
  }

  return (
    <MarketingLayout>
      <section className="marketing-register">
        <div className="marketing-register-shell">
          <div className="marketing-register-line marketing-register-line-left" />
          <div className="marketing-register-line marketing-register-line-right" />

          <div className="marketing-register-card">
            {success ? (
              <>
                <div className="marketing-register-progress">
                  <div className="marketing-register-step active">
                    <span>01</span>
                    <strong>Company</strong>
                  </div>
                  <div className="marketing-register-progress-line" />
                  <div className="marketing-register-step active">
                    <span>02</span>
                    <strong>Superadmin</strong>
                  </div>
                </div>

                <h1>Check your email</h1>
                <p className="marketing-register-copy marketing-register-copy-wide">
                  Your workspace <strong>{success.tenant.tenant_id}</strong> has been created.
                  Verify the admin email sent to <strong>{success.verification.destination}</strong>{' '}
                  to continue setup.
                </p>

                {success.verification.dev_otp ? (
                  <div className="marketing-register-success-note">
                    Dev OTP: <strong>{success.verification.dev_otp}</strong>
                  </div>
                ) : null}

                <div className="marketing-register-actions marketing-register-actions-single">
                  <a
                    className="marketing-register-submit marketing-register-submit-link"
                    href={`/login?workspace=${encodeURIComponent(success.tenant.tenant_id)}`}
                  >
                    Go to login
                  </a>
                </div>
              </>
            ) : (
              <>
            <div className="marketing-register-progress">
              <div
                className={phase === 1 ? 'marketing-register-step active' : 'marketing-register-step'}
              >
                <span>01</span>
                <strong>Company</strong>
              </div>
              <div className="marketing-register-progress-line" />
              <div
                className={phase === 2 ? 'marketing-register-step active' : 'marketing-register-step'}
              >
                <span>02</span>
                <strong>Superadmin</strong>
              </div>
            </div>

            <h1>
              {phase === 1 ? 'Create your workspace' : 'Set up your owner account'}
            </h1>
            <p className="marketing-register-copy">
              {phase === 1
                ? 'Start with your company and workspace details so we can provision the right payroll tenant.'
                : 'Add the primary owner details for the person who will manage offices, admins, and payroll.'}
            </p>

            {phase === 1 ? (
              <form className="marketing-register-form">
                <label className="marketing-register-form-full">
                  <span>Company name</span>
                  <input
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Your company"
                    type="text"
                    value={companyName}
                  />
                </label>

                <label className="marketing-register-form-full">
                  <span>Workspace slug</span>
                  <input
                    onBlur={() => {
                      if (normalizedWorkspace) {
                        void verifyWorkspace(normalizedWorkspace);
                      }
                    }}
                    onChange={(event) => {
                      setHasEditedWorkspace(true);
                      setWorkspaceSlug(event.target.value);
                      setWorkspaceStatus({ state: 'idle', message: null });
                    }}
                    placeholder="your-company"
                    type="text"
                    value={workspaceSlug}
                  />
                </label>

                {workspaceStatus.message ? (
                  <p
                    className={`marketing-register-workspace-status marketing-register-form-full ${
                      workspaceStatus.state === 'available'
                        ? 'is-available'
                        : workspaceStatus.state === 'taken'
                          ? 'is-taken'
                          : ''
                    }`}
                  >
                    {workspaceStatus.message}
                  </p>
                ) : null}

                {error ? <p className="marketing-register-error marketing-register-form-full">{error}</p> : null}

                <div className="marketing-register-actions marketing-register-form-full">
                  <a className="marketing-register-link" href="/login">
                    Already have access?
                  </a>
                  <button
                    className="marketing-register-submit"
                    onClick={handlePhaseOneContinue}
                    type="button"
                  >
                    Continue
                  </button>
                </div>
              </form>
            ) : (
              <form className="marketing-register-form" onSubmit={handleRegisterSubmit}>
                <label className="marketing-register-form-full">
                  <span>Full name</span>
                  <input
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Demo Owner"
                    type="text"
                    value={fullName}
                  />
                </label>

                <label>
                  <span>Work email</span>
                  <input
                    onChange={(event) => setAdminEmail(event.target.value)}
                    placeholder="owner@company.com"
                    type="email"
                    value={adminEmail}
                  />
                </label>

                <label>
                  <span>Work phone</span>
                  <input
                    onChange={(event) => setAdminPhone(event.target.value)}
                    placeholder="+91 98765 43210"
                    type="tel"
                    value={adminPhone}
                  />
                </label>

                <label>
                  <span>Password</span>
                  <input
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create password"
                    type="password"
                    value={password}
                  />
                </label>

                <label>
                  <span>Confirm password</span>
                  <input
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm password"
                    type="password"
                    value={confirmPassword}
                  />
                </label>

                {error ? <p className="marketing-register-error marketing-register-form-full">{error}</p> : null}

                <div className="marketing-register-actions marketing-register-form-full">
                  <button
                    className="marketing-register-secondary"
                    onClick={() => {
                      setError(null);
                      setPhase(1);
                    }}
                    type="button"
                  >
                    Back
                  </button>
                  <button className="marketing-register-submit" disabled={isSubmitting} type="submit">
                    {isSubmitting ? 'Creating workspace...' : 'Create workspace'}
                  </button>
                </div>
              </form>
            )}
              </>
            )}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
