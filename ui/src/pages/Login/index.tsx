import { MarketingLayout } from '../../layouts/MarketingLayout';
import './style.scss';

export function LoginPage() {
  return (
    <MarketingLayout>
      <section className="marketing-login">
        <div className="marketing-login-shell">
          <div className="marketing-login-line marketing-login-line-left" />
          <div className="marketing-login-line marketing-login-line-right" />

          <div className="marketing-login-card">
            <h1>Sign in</h1>
            <p className="marketing-login-card-copy">
              Access payroll runs, uploads, and employee operations in one place.
            </p>

            <form className="marketing-login-form">
              <label>
                <span>Email / Phone number</span>
                <input placeholder="Enter email or phone number" type="text" />
              </label>

              <label>
                <span>Passcode</span>
                <input placeholder="Enter passcode" type="password" />
              </label>

              <a className="marketing-login-help" href="/#contact">
                Having trouble signing in?
              </a>

              <button className="marketing-login-submit" type="button">
                Sign in
              </button>
            </form>

            <p className="marketing-login-footer">
              Don’t have an account? <a href="/register">Request now</a>
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
