import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { Field } from '../../components/atoms/Field';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppLayout } from '../../layouts/AppLayout';
import { saveHrSession } from '../../services/hrSession';
import { loginHrAdmin } from '../../services/worknestApi';
import { useTenantStore } from '../../stores/tenantStore';
import './style.scss';

type FormErrors = {
  workspaceSlug?: string;
  adminEmail?: string;
  adminPassword?: string;
};

type Notice = {
  kind: 'success' | 'error';
  message: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function workspaceAddressPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .slice(0, 80);
}

export function LoginPage() {
  const navigate = useNavigate();
  const tenant = useTenantStore((state) => state.tenant);
  usePageTitle('Login');

  const [workspaceSlug, setWorkspaceSlug] = useState(tenant.tenantId);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm() {
    const nextErrors: FormErrors = {};
    if (!workspaceSlug.trim()) {
      nextErrors.workspaceSlug = 'Company ID is required.';
    }
    if (!adminEmail.trim()) {
      nextErrors.adminEmail = 'Admin email is required.';
    } else if (!isValidEmail(adminEmail)) {
      nextErrors.adminEmail = 'Enter a valid admin email.';
    }
    if (!adminPassword) {
      nextErrors.adminPassword = 'Password is required.';
    }
    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      const tenantId = workspaceSlug.trim();
      const response = await loginHrAdmin(tenantId, {
        email: adminEmail.trim(),
        password: adminPassword,
      });
      saveHrSession({
        token: response.token,
        tenantId,
        userName: response.user.name,
      });
      setNotice({
        kind: 'success',
        message: `Welcome back, ${response.user.name}.`,
      });
      navigate('/dashboard');
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout tenant={tenant}>
      <div className="login-page-shell">
        <section className="login-page" aria-labelledby="login-title">
          <div className="login-visual">
            <div className="login-intro">
              <h1 id="login-title">Welcome back to your workspace.</h1>
              <p>
                Sign in with your Company ID and HR admin credentials to continue
                office and branch setup.
              </p>
            </div>
          </div>

          <div className="login-form-area">
            {notice ? (
              <div className={`login-notice ${notice.kind}`} role="status">
                {notice.message}
              </div>
            ) : null}

            <div className="login-panel">
              <form className="login-form" onSubmit={handleSubmit}>
                <div className="panel-heading">
                  <p className="eyebrow">HR Login</p>
                  <h2>Sign in</h2>
                  <p>Use the admin account created during registration.</p>
                </div>

                <Field label="Company ID" error={errors.workspaceSlug}>
                  <input
                    autoComplete="organization"
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

                <Field label="Password" error={errors.adminPassword}>
                  <input
                    autoComplete="current-password"
                    name="adminPassword"
                    onChange={(event) => {
                      setAdminPassword(event.target.value);
                      setErrors((current) => ({
                        ...current,
                        adminPassword: undefined,
                      }));
                    }}
                    placeholder="Your password"
                    type="password"
                    value={adminPassword}
                  />
                </Field>

                <div className="login-actions">
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? 'Signing in...' : 'Sign in'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
