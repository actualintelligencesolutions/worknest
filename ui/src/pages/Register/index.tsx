import { useState } from 'react';
import { MarketingLayout } from '../../layouts/MarketingLayout';
import './style.scss';

type Phase = 1 | 2;

export function RegisterPage() {
  const [phase, setPhase] = useState<Phase>(1);

  return (
    <MarketingLayout>
      <section className="marketing-register">
        <div className="marketing-register-shell">
          <div className="marketing-register-line marketing-register-line-left" />
          <div className="marketing-register-line marketing-register-line-right" />

          <div className="marketing-register-card">
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
              {phase === 1 ? 'Register your company' : 'Set up your superadmin'}
            </h1>
            <p className="marketing-register-copy">
              {phase === 1
                ? 'Start with the company details so we can create the right payroll workspace.'
                : 'Add the primary admin details for the person who will manage the workspace.'}
            </p>

            {phase === 1 ? (
              <form className="marketing-register-form">
                <label className="marketing-register-form-full">
                  <span>Company name</span>
                  <input placeholder="Your company" type="text" />
                </label>

                <label>
                  <span>Company email</span>
                  <input placeholder="ops@company.com" type="email" />
                </label>

                <label>
                  <span>Phone</span>
                  <input placeholder="+91 98765 43210" type="tel" />
                </label>

                <div className="marketing-register-actions marketing-register-form-full">
                  <a className="marketing-register-link" href="/login">
                    Already have access?
                  </a>
                  <button
                    className="marketing-register-submit"
                    onClick={() => setPhase(2)}
                    type="button"
                  >
                    Continue
                  </button>
                </div>
              </form>
            ) : (
              <form className="marketing-register-form">
                <label className="marketing-register-form-full">
                  <span>Full name</span>
                  <input placeholder="Superadmin name" type="text" />
                </label>

                <label className="marketing-register-form-full">
                  <span>Designation</span>
                  <select defaultValue="">
                    <option disabled value="">
                      Select designation
                    </option>
                    <option value="superadmin">Superadmin</option>
                    <option value="hr-manager">HR Manager</option>
                    <option value="operations-head">Operations Head</option>
                  </select>
                </label>

                <label>
                  <span>Work email</span>
                  <input placeholder="admin@company.com" type="email" />
                </label>

                <label>
                  <span>Work phone</span>
                  <input placeholder="+91 98765 43210" type="tel" />
                </label>

                <label>
                  <span>Password</span>
                  <input placeholder="Create password" type="password" />
                </label>

                <label>
                  <span>Confirm password</span>
                  <input placeholder="Confirm password" type="password" />
                </label>

                <div className="marketing-register-actions marketing-register-form-full">
                  <button
                    className="marketing-register-secondary"
                    onClick={() => setPhase(1)}
                    type="button"
                  >
                    Back
                  </button>
                  <button className="marketing-register-submit" type="button">
                    Create workspace
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
