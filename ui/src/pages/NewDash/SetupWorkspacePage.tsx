import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { usePageTitle } from '../../hooks/usePageTitle';
import { NewPrimaryLayout } from '../../layouts/NewPrimary';
import setupIllustration from '../../assets/images/Setup.png';
import { clearHrSession, loadHrSession } from '../../services/hrSession';
import {
  createOffice,
  listCompanyLocations,
  listPlans,
  logout,
  type OfficeCreationResult,
  type Plan,
} from '../../services/worknestApi';
import './setup.scss';

type OfficeType = 'main_office' | 'branch';
type SetupStepKey = 'locationType' | 'officeDetails' | 'manager' | 'plan' | 'complete';

type OfficeDetailsState = {
  name: string;
  city: string;
  state: string;
};

type ManagerDetailsState = {
  name: string;
  email: string;
  phone: string;
};

function getVisibleSteps(officeType: OfficeType | null): SetupStepKey[] {
  return officeType === 'branch'
    ? ['locationType', 'officeDetails', 'manager', 'plan', 'complete']
    : ['locationType', 'officeDetails', 'plan', 'complete'];
}

function formatPrice(plan: Plan) {
  const amount = plan.price_cents / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: plan.currency || 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function planFeatures(plan: Plan) {
  if (Array.isArray(plan.features_json)) {
    return plan.features_json.map(String);
  }

  if (typeof plan.features_json === 'string') {
    try {
      const parsed = JSON.parse(plan.features_json) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch {
      return [];
    }
  }

  return [];
}

export function SetupWorkspacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = loadHrSession();
  usePageTitle(t('pages.newDash.setupWorkspace.title'));

  const [officeType, setOfficeType] = useState<OfficeType | null>(null);
  const [currentStep, setCurrentStep] = useState<SetupStepKey>('locationType');
  const [officeDetails, setOfficeDetails] = useState<OfficeDetailsState>({
    name: '',
    city: '',
    state: '',
  });
  const [managerDetails, setManagerDetails] = useState<ManagerDetailsState>({
    name: '',
    email: '',
    phone: '',
  });
  const [workspaceLogo, setWorkspaceLogo] = useState<File | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [completionResult, setCompletionResult] = useState<OfficeCreationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const visibleSteps = useMemo(() => getVisibleSteps(officeType), [officeType]);
  const currentStepIndex = Math.max(visibleSteps.indexOf(currentStep), 0);
  const currentVisibleStep = visibleSteps[currentStepIndex] ?? 'locationType';
  const progressTotal = Math.max(visibleSteps.length - 1, 1);
  const progressCurrent = Math.min(currentStepIndex + 1, progressTotal);

  useEffect(() => {
    if (!visibleSteps.includes(currentStep)) {
      setCurrentStep(visibleSteps[0] ?? 'locationType');
    }
  }, [currentStep, visibleSteps]);

  const locationsQuery = useQuery({
    queryKey: ['setup-workspace-locations', session?.tenantId],
    queryFn: () => listCompanyLocations(session!),
    enabled: Boolean(session),
  });

  const plansQuery = useQuery({
    queryKey: ['setup-workspace-plans'],
    queryFn: listPlans,
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (!session || locationsQuery.isLoading) {
      return;
    }

    if (!completionResult && (locationsQuery.data?.locations ?? []).length > 0) {
      navigate('/new-dash', { replace: true });
    }
  }, [completionResult, locationsQuery.data?.locations, locationsQuery.isLoading, navigate, session]);

  async function handleLogout() {
    try {
      if (session) {
        await logout(session);
      }
    } catch {
      // Local cleanup is still enough to sign the user out in the UI.
    } finally {
      clearHrSession();
      navigate('/login');
    }
  }

  const createOfficeMutation = useMutation({
    mutationFn: async () => {
      if (!session || !officeType || !selectedPlanId) {
        throw new Error(t('pages.newDash.setupWizard.errors.incomplete'));
      }

      return createOffice(session, {
        office_type: officeType,
        name: officeDetails.name.trim(),
        city: officeDetails.city.trim(),
        state: officeDetails.state.trim(),
        plan_id: selectedPlanId,
        contact_email: officeType === 'branch' ? managerDetails.email.trim() : undefined,
        contact_phone: officeType === 'branch' ? managerDetails.phone.trim() : undefined,
        admin_name: officeType === 'branch' ? managerDetails.name.trim() : undefined,
        admin_email: officeType === 'branch' ? managerDetails.email.trim() : undefined,
        admin_phone: officeType === 'branch' ? managerDetails.phone.trim() : undefined,
        logo: workspaceLogo,
      });
    },
    onSuccess: async (result) => {
      setCompletionResult(result);
      setErrorMessage(null);
      setCurrentStep('complete');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['setup-workspace-locations', session?.tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-locations', session?.tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['new-dash-office-plan', session?.tenantId] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : t('pages.newDash.setupWizard.errors.submit'));
    },
  });

  function validateCurrentStep(step: SetupStepKey) {
    if (step === 'locationType') {
      return Boolean(officeType);
    }

    if (step === 'officeDetails') {
      return (
        officeDetails.name.trim() !== '' &&
        officeDetails.city.trim() !== '' &&
        officeDetails.state.trim() !== ''
      );
    }

    if (step === 'manager') {
      return (
        managerDetails.name.trim() !== '' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerDetails.email.trim()) &&
        managerDetails.phone.trim() !== ''
      );
    }

    if (step === 'plan') {
      return Boolean(selectedPlanId);
    }

    return true;
  }

  function handleNext() {
    if (!validateCurrentStep(currentVisibleStep)) {
      setErrorMessage(t('pages.newDash.setupWizard.errors.validation'));
      return;
    }

    setErrorMessage(null);

    if (currentVisibleStep === 'plan') {
      void createOfficeMutation.mutateAsync();
      return;
    }

    const nextStep = visibleSteps[currentStepIndex + 1];
    if (nextStep) {
      setCurrentStep(nextStep);
    }
  }

  function handleBack() {
    setErrorMessage(null);
    const previousStep = visibleSteps[currentStepIndex - 1];
    if (previousStep) {
      setCurrentStep(previousStep);
    }
  }

  const isLoading = Boolean(session) && (locationsQuery.isLoading || plansQuery.isLoading);
  const hasError = locationsQuery.error || plansQuery.error;
  const plans = plansQuery.data?.plans ?? [];
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? completionResult?.plan ?? null;
  const isSubmitting = createOfficeMutation.isPending;
  const canGoBack = currentVisibleStep !== 'locationType' && currentVisibleStep !== 'complete';
  const continueLabel =
    currentVisibleStep === 'plan'
      ? t('pages.newDash.setupWizard.actions.finish')
      : t('pages.newDash.setupWizard.actions.continue');

  function renderIllustration() {
    const illustrationClassName = `new-dash-setup-illustration new-dash-setup-illustration-${currentVisibleStep}`;

    if (currentVisibleStep === 'complete') {
      return (
        <div className={illustrationClassName} aria-hidden="true">
          <div className="new-dash-setup-illustration-screen" />
          <div className="new-dash-setup-illustration-check" />
          <div className="new-dash-setup-illustration-base" />
        </div>
      );
    }

    return (
      <div className={illustrationClassName} aria-hidden="true">
        <div className="new-dash-setup-illustration-orb new-dash-setup-illustration-orb-one" />
        <div className="new-dash-setup-illustration-orb new-dash-setup-illustration-orb-two" />
        <div className="new-dash-setup-illustration-panel">
          <img
            alt=""
            className="new-dash-setup-illustration-image"
            src={setupIllustration}
          />
        </div>
        <div className="new-dash-setup-illustration-card" />
      </div>
    );
  }

  function renderStepBody() {
    if (currentVisibleStep === 'locationType') {
      return (
        <div className="new-dash-setup-option-grid">
          <button
            className={
              officeType === 'main_office'
                ? 'new-dash-setup-option-card is-selected'
                : 'new-dash-setup-option-card'
            }
            onClick={() => {
              setOfficeType('main_office');
              setErrorMessage(null);
            }}
            type="button"
          >
            <span className="new-dash-setup-option-icon">HQ</span>
            <strong>{t('pages.newDash.setupWizard.locationType.mainOffice.title')}</strong>
            <p>{t('pages.newDash.setupWizard.locationType.mainOffice.description')}</p>
          </button>

          <button
            className={
              officeType === 'branch'
                ? 'new-dash-setup-option-card is-selected'
                : 'new-dash-setup-option-card'
            }
            onClick={() => {
              setOfficeType('branch');
              setErrorMessage(null);
            }}
            type="button"
          >
            <span className="new-dash-setup-option-icon">Site</span>
            <strong>{t('pages.newDash.setupWizard.locationType.siteOffice.title')}</strong>
            <p>{t('pages.newDash.setupWizard.locationType.siteOffice.description')}</p>
          </button>
        </div>
      );
    }

    if (currentVisibleStep === 'officeDetails') {
      const isSiteOffice = officeType === 'branch';

      return (
        <div className="new-dash-setup-form-grid">
          <label className="new-dash-setup-form-full">
            <span>{isSiteOffice ? t('pages.newDash.setupWizard.officeDetails.siteName') : t('pages.newDash.setupWizard.officeDetails.mainName')}</span>
            <input
              onChange={(event) =>
                setOfficeDetails((current) => ({ ...current, name: event.target.value }))
              }
              placeholder={
                isSiteOffice
                  ? t('pages.newDash.setupWizard.officeDetails.siteNamePlaceholder')
                  : t('pages.newDash.setupWizard.officeDetails.mainNamePlaceholder')
              }
              value={officeDetails.name}
            />
          </label>

          <label className="new-dash-setup-form-full">
            <span>{t('pages.newDash.setupWizard.officeDetails.logo')}</span>
            <input
              accept="image/png,image/jpeg,image/webp"
              className="new-dash-setup-file-input"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setWorkspaceLogo(nextFile);
              }}
              type="file"
            />
            <small className="new-dash-setup-field-note">
              {workspaceLogo
                ? t('pages.newDash.setupWizard.officeDetails.logoSelected', {
                    fileName: workspaceLogo.name,
                  })
                : t('pages.newDash.setupWizard.officeDetails.logoHint')}
            </small>
          </label>

          <label>
            <span>{t('pages.newDash.setupWizard.officeDetails.city')}</span>
            <input
              onChange={(event) =>
                setOfficeDetails((current) => ({ ...current, city: event.target.value }))
              }
              placeholder={t('pages.newDash.setupWizard.officeDetails.cityPlaceholder')}
              value={officeDetails.city}
            />
          </label>

          <label>
            <span>{t('pages.newDash.setupWizard.officeDetails.state')}</span>
            <input
              onChange={(event) =>
                setOfficeDetails((current) => ({ ...current, state: event.target.value }))
              }
              placeholder={t('pages.newDash.setupWizard.officeDetails.statePlaceholder')}
              value={officeDetails.state}
            />
          </label>
        </div>
      );
    }

    if (currentVisibleStep === 'manager') {
      return (
        <div className="new-dash-setup-form-grid">
          <label className="new-dash-setup-form-full">
            <span>{t('pages.newDash.setupWizard.manager.name')}</span>
            <input
              onChange={(event) =>
                setManagerDetails((current) => ({ ...current, name: event.target.value }))
              }
              placeholder={t('pages.newDash.setupWizard.manager.namePlaceholder')}
              value={managerDetails.name}
            />
          </label>

          <label>
            <span>{t('pages.newDash.setupWizard.manager.email')}</span>
            <input
              onChange={(event) =>
                setManagerDetails((current) => ({ ...current, email: event.target.value }))
              }
              placeholder={t('pages.newDash.setupWizard.manager.emailPlaceholder')}
              type="email"
              value={managerDetails.email}
            />
          </label>

          <label>
            <span>{t('pages.newDash.setupWizard.manager.phone')}</span>
            <input
              onChange={(event) =>
                setManagerDetails((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder={t('pages.newDash.setupWizard.manager.phonePlaceholder')}
              value={managerDetails.phone}
            />
          </label>
        </div>
      );
    }

    if (currentVisibleStep === 'plan') {
      return (
        <div className="new-dash-setup-plan-grid">
          {plans.map((plan) => {
            const features = planFeatures(plan);
            const isSelected = selectedPlanId === plan.id;

            return (
              <button
                className={
                  isSelected
                    ? 'new-dash-setup-plan-card is-selected'
                    : 'new-dash-setup-plan-card'
                }
                key={plan.id}
                onClick={() => {
                  setSelectedPlanId(plan.id);
                  setErrorMessage(null);
                }}
                type="button"
              >
                <div className="new-dash-setup-plan-head">
                  <div>
                    <strong>{plan.name}</strong>
                    <span>{plan.plan_code}</span>
                  </div>
                  <em>{formatPrice(plan)}</em>
                </div>
                <p>{plan.description ?? t('pages.newDash.setupWizard.planSelection.defaultDescription')}</p>
                <div className="new-dash-setup-plan-meta">
                  <span>
                    {t('pages.newDash.setupWizard.planSelection.employeeLimit', {
                      count: plan.employee_limit ?? 0,
                    })}
                  </span>
                  <span>
                    {t('pages.newDash.setupWizard.planSelection.payrollLimit', {
                      count: plan.monthly_payroll_limit ?? 0,
                    })}
                  </span>
                </div>
                {features.length > 0 ? (
                  <div className="new-dash-setup-plan-features">
                    {features.slice(0, 4).map((feature) => (
                      <span key={feature}>{feature.replaceAll('_', ' ')}</span>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="new-dash-setup-complete">
        <div className="new-dash-setup-complete-badge">
          {t('pages.newDash.setupWizard.complete.badge')}
        </div>
        <h3>{t('pages.newDash.setupWizard.complete.heading')}</h3>
        <p>{t('pages.newDash.setupWizard.complete.description')}</p>
        <div className="new-dash-setup-summary">
          <div>
            <span>{t('pages.newDash.setupWizard.complete.summary.locationType')}</span>
            <strong>
              {officeType === 'branch'
                ? t('pages.newDash.setupWizard.locationType.siteOffice.title')
                : t('pages.newDash.setupWizard.locationType.mainOffice.title')}
            </strong>
          </div>
          <div>
            <span>{t('pages.newDash.setupWizard.complete.summary.locationName')}</span>
            <strong>{completionResult?.office.name ?? officeDetails.name}</strong>
          </div>
          <div>
            <span>{t('pages.newDash.setupWizard.complete.summary.region')}</span>
            <strong>{`${officeDetails.city}, ${officeDetails.state}`}</strong>
          </div>
          <div>
            <span>{t('pages.newDash.setupWizard.complete.summary.package')}</span>
            <strong>{selectedPlan?.name ?? t('pages.newDash.workspace.fallback')}</strong>
          </div>
        </div>
      </div>
    );
  }

  function titleForStep(step: SetupStepKey) {
    switch (step) {
      case 'locationType':
        return t('pages.newDash.setupWizard.locationType.title');
      case 'officeDetails':
        return officeType === 'branch'
          ? t('pages.newDash.setupWizard.officeDetails.siteTitle')
          : t('pages.newDash.setupWizard.officeDetails.mainTitle');
      case 'manager':
        return t('pages.newDash.setupWizard.manager.title');
      case 'plan':
        return t('pages.newDash.setupWizard.planSelection.title');
      case 'complete':
        return t('pages.newDash.setupWizard.complete.title');
    }
  }

  function descriptionForStep(step: SetupStepKey) {
    switch (step) {
      case 'locationType':
        return t('pages.newDash.setupWizard.locationType.description');
      case 'officeDetails':
        return officeType === 'branch'
          ? t('pages.newDash.setupWizard.officeDetails.siteDescription')
          : t('pages.newDash.setupWizard.officeDetails.mainDescription');
      case 'manager':
        return t('pages.newDash.setupWizard.manager.description');
      case 'plan':
        return t('pages.newDash.setupWizard.planSelection.description');
      case 'complete':
        return t('pages.newDash.setupWizard.complete.description');
    }
  }

  return (
    <NewPrimaryLayout
      headerNavItems={[]}
      headerVariant="quiet"
      onLogout={session ? handleLogout : undefined}
    >
      <section className="new-dash-setup-shell">
        {!session ? (
          <div className="new-dash-setup-card">
            <div className="new-dash-setup-content">
              <p className="new-dash-setup-kicker">{t('pages.newDash.setupWizard.kicker')}</p>
              <h1>{t('pages.newDash.authRequired.title')}</h1>
              <p className="new-dash-setup-copy">{t('pages.newDash.authRequired.description')}</p>
              <div className="new-dash-setup-actions">
                <Button as={Link} to="/login">
                  {t('pages.newDash.authRequired.action')}
                </Button>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="new-dash-setup-card">
            <div className="new-dash-setup-content">
              <p className="new-dash-setup-kicker">{t('pages.newDash.setupWizard.kicker')}</p>
              <h1>{t('pages.newDash.loading.title')}</h1>
              <p className="new-dash-setup-copy">{t('common.loading')}</p>
            </div>
          </div>
        ) : hasError ? (
          <div className="new-dash-setup-card">
            <div className="new-dash-setup-content">
              <p className="new-dash-setup-kicker">{t('pages.newDash.setupWizard.kicker')}</p>
              <h1>{t('pages.newDash.error.title')}</h1>
              <p className="new-dash-setup-copy">{(hasError as Error).message}</p>
            </div>
          </div>
        ) : (
          <div className="new-dash-setup-card">
            <div className="new-dash-setup-visual">
              <div className="new-dash-setup-progress">
                <span>{t('pages.newDash.setupWizard.progress', { current: progressCurrent, total: progressTotal })}</span>
                <div className="new-dash-setup-progress-dots" aria-hidden="true">
                  {visibleSteps
                    .filter((step) => step !== 'complete')
                    .map((step, index) => (
                      <span
                        className={
                          index <= currentStepIndex
                            ? 'new-dash-setup-progress-dot is-active'
                            : 'new-dash-setup-progress-dot'
                        }
                        key={step}
                      />
                    ))}
                </div>
              </div>

              <div className="new-dash-setup-visual-copy">
                <p className="new-dash-setup-kicker">{t('pages.newDash.setupWizard.kicker')}</p>
                <h1>{t('pages.newDash.setupWorkspace.title')}</h1>
                <p>{t('pages.newDash.setupWizard.intro')}</p>
              </div>

              {renderIllustration()}
            </div>

            <div className="new-dash-setup-content">
              <div className="new-dash-setup-step-head">
                <h2>{titleForStep(currentVisibleStep)}</h2>
                <p className="new-dash-setup-copy">{descriptionForStep(currentVisibleStep)}</p>
              </div>

              {renderStepBody()}

              {errorMessage ? <p className="new-dash-setup-error">{errorMessage}</p> : null}

              <div className="new-dash-setup-actions">
                {currentVisibleStep === 'complete' ? (
                  <Button
                    onClick={() => {
                      navigate('/new-dash');
                    }}
                    type="button"
                  >
                    {t('pages.newDash.setupWizard.actions.openDashboard')}
                  </Button>
                ) : (
                  <>
                    <button
                      className="new-dash-setup-back"
                      disabled={!canGoBack || isSubmitting}
                      onClick={handleBack}
                      type="button"
                    >
                      {t('pages.newDash.setupWizard.actions.back')}
                    </button>
                    <Button disabled={!validateCurrentStep(currentVisibleStep) || isSubmitting} onClick={handleNext} type="button">
                      {isSubmitting ? t('pages.newDash.setupWizard.actions.finishing') : continueLabel}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </NewPrimaryLayout>
  );
}
