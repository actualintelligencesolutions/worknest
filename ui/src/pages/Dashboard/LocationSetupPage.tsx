import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { Field } from '../../components/atoms/Field';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppLayout } from '../../layouts/AppLayout';
import { loadHrSession } from '../../services/hrSession';
import {
  createBranch,
  createMainOffice,
  listPlans,
  type AuthSession,
  type Plan,
} from '../../services/worknestApi';
import { useTenantStore } from '../../stores/tenantStore';
import './location-setup.scss';

type LocationSetupMode = 'main-office' | 'branch';

type FormErrors = {
  branchName?: string;
  adminName?: string;
  adminEmail?: string;
  planId?: string;
};

type Notice = {
  kind: 'success' | 'error' | 'info';
  message: string;
};

type LocationSetupPageProps = {
  mode: LocationSetupMode;
};

type SetupStep = 'details' | 'plan';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function planLabel(plan: Plan) {
  const amount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.price_cents / 100);

  return `${plan.name} - ${amount}`;
}

export function LocationSetupPage({ mode }: LocationSetupPageProps) {
  const tenant = useTenantStore((state) => state.tenant);
  const isBranch = mode === 'branch';
  const pageTitle = isBranch
    ? 'Create a new branch'
    : 'Create your main office';
  const locationLabel = isBranch ? 'branch' : 'main office';
  usePageTitle(pageTitle);

  const [session, setSession] = useState<AuthSession | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [branchName, setBranchName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [planId, setPlanId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('details');
  const locationName = isBranch
    ? branchName.trim() || 'Bangalore Branch'
    : 'Main Office';

  const selectedPlan = useMemo(
    () => plans.find((plan) => String(plan.id) === planId),
    [plans, planId],
  );

  useEffect(() => {
    setSession(loadHrSession());

    let isCurrent = true;
    async function loadPlans() {
      try {
        const response = await listPlans();
        if (!isCurrent) {
          return;
        }
        setPlans(response.plans);
        setPlanId(
          (currentPlanId) =>
            currentPlanId || String(response.plans[0]?.id ?? ''),
        );
      } catch (error) {
        if (!isCurrent) {
          return;
        }
        setNotice({ kind: 'error', message: (error as Error).message });
      } finally {
        if (isCurrent) {
          setIsLoadingPlans(false);
        }
      }
    }

    void loadPlans();

    return () => {
      isCurrent = false;
    };
  }, []);

  function validateDetails() {
    const nextErrors: FormErrors = {};
    if (isBranch && !branchName.trim()) {
      nextErrors.branchName = 'Branch name is required.';
    }
    if (!adminName.trim()) {
      nextErrors.adminName = 'Admin name is required.';
    }
    if (!adminEmail.trim()) {
      nextErrors.adminEmail = 'Admin email is required.';
    } else if (!isValidEmail(adminEmail)) {
      nextErrors.adminEmail = 'Enter a valid admin email.';
    }
    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function validatePlan() {
    const nextErrors: FormErrors = {};
    if (!selectedPlan) {
      nextErrors.planId = 'Choose an active plan.';
    }
    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function handleDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validateDetails()) {
      setSetupStep('plan');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      setNotice({
        kind: 'error',
        message:
          'Complete registration and email verification before creating offices or branches.',
      });
      return;
    }
    if (!validatePlan() || !selectedPlan) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      const response = isBranch
        ? await createBranch(session, {
            branch_name: branchName.trim(),
            admin_name: adminName.trim(),
            admin_email: adminEmail.trim(),
            plan_id: selectedPlan.id,
          })
        : await createMainOffice(session, {
            admin_name: adminName.trim(),
            admin_email: adminEmail.trim(),
            plan_id: selectedPlan.id,
          });
      setNotice({
        kind: 'success',
        message: `${response.location.name} was created with ${response.plan.name}. ${response.admin.name} is pending verification.`,
      });
      if (isBranch) {
        setBranchName('');
      }
      setAdminName('');
      setAdminEmail('');
      setErrors({});
      setSetupStep('details');
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout tenant={tenant}>
      <section
        className="location-setup-page"
        aria-labelledby="location-setup-title"
      >
        <div className="location-setup-heading">
          <p className="eyebrow">Dashboard setup</p>
          <h1 id="location-setup-title">{pageTitle}</h1>
          <p>
            {isBranch
              ? 'Set up a workspace for your team. This branch will have its own admin and configuration.'
              : 'Set up the primary workspace for your company. This office will have its own admin and configuration.'}
          </p>
        </div>

        {notice ? (
          <div className={`location-setup-notice ${notice.kind}`} role="status">
            {notice.message}
          </div>
        ) : null}

        {!session ? (
          <div className="location-setup-session">
            <strong>Registration required</strong>
            <p>
              Complete company registration and email OTP verification before
              creating offices or branches.
            </p>
            <Link
              className="button button-secondary"
              target="_blank"
              rel="noreferrer"
              to="/register"
            >
              Go to registration
            </Link>
          </div>
        ) : null}

        <div className="location-setup-shell">
          <div className="location-setup-card">
            <div className="location-setup-progress">
              <span>
                Step {setupStep === 'details' ? '1' : '2'} of 2 —{' '}
                {setupStep === 'details'
                  ? `${isBranch ? 'Branch' : 'Office'} Details`
                  : 'Plan'}
              </span>
              <ol className="location-setup-stepper" aria-label="Setup progress">
                <li
                  className={setupStep === 'details' ? 'active' : 'complete'}
                >
                  <span />
                  <strong>Details</strong>
                </li>
                <li className={setupStep === 'plan' ? 'active' : undefined}>
                  <span />
                  <strong>Plan</strong>
                </li>
              </ol>
            </div>

            {setupStep === 'details' ? (
              <form
                className="location-setup-form"
                onSubmit={handleDetailsSubmit}
              >
                {isBranch ? (
                  <section className="location-form-section">
                    <div className="location-form-section-heading">
                      <span>01</span>
                      <div>
                        <h2>Branch Information</h2>
                        <p>Name this workspace so it is easy to recognize.</p>
                      </div>
                    </div>

                    <Field
                      label="What should we call this branch?"
                      error={errors.branchName}
                    >
                      <input
                        autoComplete="organization"
                        name="branchName"
                        onChange={(event) => {
                          setBranchName(event.target.value);
                          setErrors((current) => ({
                            ...current,
                            branchName: undefined,
                          }));
                        }}
                        placeholder="Bangalore Branch"
                        value={branchName}
                      />
                    </Field>
                  </section>
                ) : (
                  <section className="location-form-section">
                    <div className="location-form-section-heading">
                      <span>01</span>
                      <div>
                        <h2>Main Office Information</h2>
                        <p>
                          Worknest will use Main Office as the primary company
                          workspace.
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                <section className="location-form-section">
                  <div className="location-form-section-heading">
                    <span>02</span>
                    <div>
                      <h2>Admin Information</h2>
                      <p>
                        This person will manage employees and payroll for this{' '}
                        {locationLabel}.
                      </p>
                    </div>
                  </div>

                  <Field
                    label={`Who will manage this ${locationLabel}?`}
                    error={errors.adminName}
                  >
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
                      placeholder="Rohit Sharma"
                      value={adminName}
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
                </section>

                <div className="location-setup-actions">
                  <Link
                    className="button button-ghost location-back-action"
                    to="/dashboard"
                  >
                    ← Back
                  </Link>
                  <Button disabled={!session} type="submit">
                    Continue →
                  </Button>
                </div>
              </form>
            ) : (
              <form className="location-setup-form" onSubmit={handleSubmit}>
                <div className="location-plan-heading">
                  <h2>Select a plan</h2>
                  <p>
                    Pick the package for this {locationLabel}. You can review
                    the admin details before creating it.
                  </p>
                </div>

                {errors.planId ? (
                  <p className="location-plan-error">{errors.planId}</p>
                ) : null}

                <div className="location-plan-options">
                  {isLoadingPlans ? (
                    <p className="location-plan-empty">Loading plans...</p>
                  ) : null}

                  {!isLoadingPlans && plans.length === 0 ? (
                    <p className="location-plan-empty">
                      No active plans available.
                    </p>
                  ) : null}

                  {plans.map((plan) => (
                    <label
                      className={`location-plan-option ${
                        String(plan.id) === planId ? 'selected' : ''
                      }`}
                      key={plan.id}
                    >
                      <input
                        checked={String(plan.id) === planId}
                        name="planId"
                        onChange={(event) => {
                          setPlanId(event.target.value);
                          setErrors((current) => ({
                            ...current,
                            planId: undefined,
                          }));
                        }}
                        type="radio"
                        value={plan.id}
                      />
                      <span>
                        <strong>{planLabel(plan)}</strong>
                        {plan.description ? (
                          <small>{plan.description}</small>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="location-setup-actions">
                  <button
                    className="button button-ghost location-back-action"
                    onClick={() => setSetupStep('details')}
                    type="button"
                  >
                    ← Back
                  </button>
                  <Button
                    disabled={!session || isLoadingPlans || isSubmitting}
                    type="submit"
                  >
                    {isSubmitting
                      ? 'Creating...'
                      : `Create ${isBranch ? 'Branch' : 'Main Office'} →`}
                  </Button>
                </div>
              </form>
            )}
          </div>

          <aside
            className="location-preview"
            aria-label={`${locationLabel} preview`}
          >
            <span>{isBranch ? 'Branch Preview' : 'Main Office Preview'}</span>
            <strong>{locationName}</strong>
            <dl>
              <div>
                <dt>Admin</dt>
                <dd>{adminName.trim() || 'Rohit Sharma'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{adminEmail.trim() || 'admin@example.com'}</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>{selectedPlan ? selectedPlan.name : 'Select a plan'}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>
    </AppLayout>
  );
}
