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
  const pageTitle = isBranch ? 'Create Branch' : 'Setup Main Office Account';
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
              ? 'Add a branch, assign its package, and create its HR admin.'
              : 'Initialize the company head office, assign its package, and create its HR admin.'}
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
            <Link className="button button-secondary" to="/register">
              Go to registration
            </Link>
          </div>
        ) : null}

        <div className="location-setup-card">
          <ol className="location-setup-stepper" aria-label="Setup progress">
            <li className={setupStep === 'details' ? 'active' : 'complete'}>
              <span>1</span>
              <strong>Details</strong>
            </li>
            <li className={setupStep === 'plan' ? 'active' : undefined}>
              <span>2</span>
              <strong>Plan</strong>
            </li>
          </ol>

          {setupStep === 'details' ? (
            <form
              className="location-setup-form"
              onSubmit={handleDetailsSubmit}
            >
              {isBranch ? (
                <Field label="Branch name" error={errors.branchName}>
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
              ) : null}

              <Field
                label={
                  isBranch ? 'Branch admin name' : 'Main office admin name'
                }
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

              <Field
                label={
                  isBranch ? 'Branch admin email' : 'Main office admin email'
                }
                error={errors.adminEmail}
              >
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

              <div className="location-setup-actions">
                <Link className="button button-secondary" to="/dashboard">
                  Back
                </Link>
                <Button disabled={!session} type="submit">
                  Continue
                </Button>
              </div>
            </form>
          ) : (
            <form className="location-setup-form" onSubmit={handleSubmit}>
              <div className="location-plan-heading">
                <h2>Select a plan</h2>
                <p>
                  Pick the package for this{' '}
                  {isBranch ? 'branch' : 'main office'}. You can review the
                  admin details before creating it.
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
                  className="button button-secondary"
                  onClick={() => setSetupStep('details')}
                  type="button"
                >
                  Back
                </button>
                <Button
                  disabled={!session || isLoadingPlans || isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? 'Creating...' : pageTitle}
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </AppLayout>
  );
}
