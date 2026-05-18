import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MarketingLayout } from '../../layouts/MarketingLayout';
import { saveHrSession } from '../../services/hrSession';
import { loginAdmin } from '../../services/worknestApi';
import './style.scss';

export function LoginPage() {
  const navigate = useNavigate();
  const { tenantId: tenantIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const presetWorkspace = useMemo(
    () => tenantIdParam?.trim() || searchParams.get('workspace')?.trim() || '',
    [searchParams, tenantIdParam],
  );
  const [workspace, setWorkspace] = useState(presetWorkspace);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasDirectWorkspace = tenantIdParam?.trim() !== '';

  useEffect(() => {
    setWorkspace(presetWorkspace);
  }, [presetWorkspace]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!workspace.trim() || !email.trim() || !password.trim()) {
      setError('Workspace, email, and password are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await loginAdmin(workspace.trim(), {
        email: email.trim(),
        password,
      });

      saveHrSession({
        token: response.session.token,
        tenantId: response.tenant.tenant_id,
        userName: response.actor.name,
        userType: response.actor.role === 'branch_admin' ? 'branch_admin' : 'tenant_owner',
      });
      navigate('/new-dash');
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to sign in.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MarketingLayout>
      <section className="marketing-login">
        <div className="marketing-login-shell">
          <div className="marketing-login-line marketing-login-line-left" />
          <div className="marketing-login-line marketing-login-line-right" />

          <div className="marketing-login-card">
            <p className="marketing-login-kicker">Admin Workspace Access</p>
            <h1>Sign in to Worknest</h1>
            <p className="marketing-login-card-copy">
              {hasDirectWorkspace
                ? `Sign in to ${workspace} with your admin email and password.`
                : 'Enter your workspace and admin credentials to manage offices, payroll, and employee access.'}
            </p>

            <form className="marketing-login-form" onSubmit={handleSubmit}>
              {hasDirectWorkspace ? (
                <div className="marketing-login-locked-workspace">
                  <span>Workspace</span>
                  <strong>{workspace}</strong>
                </div>
              ) : (
                <label>
                  <span>Workspace</span>
                  <input
                    onChange={(event) => setWorkspace(event.target.value)}
                    placeholder="your-company"
                    type="text"
                    value={workspace}
                  />
                </label>
              )}

              <label>
                <span>Work email</span>
                <input
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="owner@company.com"
                  type="email"
                  value={email}
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  type="password"
                  value={password}
                />
              </label>

              <a className="marketing-login-help" href="/#contact">
                Having trouble signing in?
              </a>

              {hasDirectWorkspace ? (
                <Link className="marketing-login-switch" to="/login">
                  Use a different workspace
                </Link>
              ) : null}

              {error ? <p className="marketing-login-error">{error}</p> : null}

              <button className="marketing-login-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="marketing-login-footer">
              Need a new workspace? <a href="/register">Create one</a>
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
