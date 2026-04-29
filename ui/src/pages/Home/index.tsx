import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppLayout } from '../../layouts/AppLayout';
import { submitContactEnquiry } from '../../services/worknestApi';
import { useTenantStore } from '../../stores/tenantStore';
import './style.scss';

const problemPoints = [
  {
    label: 'Excel everywhere, no control',
    iconClass: 'problem-card-mark-sprite-1',
  },
  {
    label: 'Payslips sent manually or via WhatsApp',
    iconClass: 'problem-card-mark-sprite-2',
  },
  {
    label: 'No central system for branches',
    iconClass: 'problem-card-mark-sprite-3',
  },
  {
    label: 'Employees constantly asking for payslips',
    iconClass: 'problem-card-mark-sprite-4',
  },
];

const solutionBlocks = [
  {
    title: 'Company & Branch Setup',
    iconClass: 'solution-card-icon-sprite-1',
    description:
      'Create your main company workspace, add branches as you grow, and keep every team inside one structured payroll system.',
  },
  {
    title: 'Payroll Upload & Processing',
    iconClass: 'solution-card-icon-sprite-2',
    description:
      'Upload payroll sheets in minutes, validate the data before publishing, and keep each payroll cycle organized and traceable.',
  },
  {
    title: 'Employee Self-Service Portal',
    iconClass: 'solution-card-icon-sprite-3',
    description:
      'Give employees a secure place to access payslips instantly without depending on HR for every request.',
  },
];

const steps = [
  {
    label: 'Register your company',
    iconClass: 'step-number-sprite-1',
  },
  {
    label: 'Add branches',
    iconClass: 'step-number-sprite-2',
  },
  {
    label: 'Upload payroll sheet',
    iconClass: 'step-number-sprite-3',
  },
  {
    label: 'Preview and validate',
    iconClass: 'step-number-sprite-4',
  },
  {
    label: 'Publish payslips',
    iconClass: 'step-number-sprite-5',
  },
  {
    label: 'Employees access instantly',
    iconClass: 'step-number-sprite-6',
  },
];

type PricingSegment = 'smb' | 'enterprise';
type BillingCycle = 'monthly' | 'yearly';

type PricingPlan = {
  name: string;
  segment: PricingSegment;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  monthlyNote: string;
  yearlyNote: string;
  features: string[];
  label?: string;
  highlighted?: boolean;
  custom?: boolean;
  eyebrow?: string;
  ctaLabel?: string;
};

const pricingTiers: PricingPlan[] = [
  {
    name: 'Starter',
    segment: 'smb',
    description: 'Perfect for small teams getting started',
    monthlyPrice: 'Free',
    yearlyPrice: 'Free',
    monthlyNote: 'Billed monthly',
    yearlyNote: 'Billed yearly',
    features: [
      'Up to 20 employees',
      'Payslip generation',
      'Employee login with PIN',
    ],
  },
  {
    name: 'Basic',
    segment: 'smb',
    description: 'For small growing teams',
    monthlyPrice: '₹500 / month',
    yearlyPrice: '₹5,000 / year',
    monthlyNote: 'Billed monthly',
    yearlyNote: 'Billed yearly, 2 months free',
    features: [
      'Up to 50 employees',
      'Payroll upload & preview',
      'Everything in Starter',
    ],
  },
  {
    name: 'Growth',
    segment: 'smb',
    label: 'Most Popular',
    description: 'Best for teams scaling payroll across locations',
    monthlyPrice: '₹1,000 / month',
    yearlyPrice: '₹10,000 / year',
    monthlyNote: 'Billed monthly',
    yearlyNote: 'Billed yearly, 2 months free',
    features: [
      'Up to 100 employees',
      'Branch-wise payroll',
      'Versioned payroll uploads',
      'Everything in Basic',
    ],
    highlighted: true,
  },
  {
    name: 'Scale',
    segment: 'smb',
    description: 'For larger operations that need more control',
    monthlyPrice: '₹3,000 / month',
    yearlyPrice: '₹30,000 / year',
    monthlyNote: 'Billed monthly',
    yearlyNote: 'Billed yearly, 2 months free',
    features: [
      'Up to 300 employees',
      'Priority processing',
      'Advanced payroll tracking',
    ],
  },
  {
    name: 'Enterprise',
    segment: 'enterprise',
    description: 'Operational oversight for large payroll teams',
    monthlyPrice: '₹5,000 / month',
    yearlyPrice: '₹50,000 / year',
    monthlyNote: 'Billed monthly',
    yearlyNote: 'Billed yearly, 2 months free',
    features: [
      'Up to 500 employees',
      'Admin controls',
      'Audit logs',
    ],
  },
  {
    name: 'Enterprise Plus',
    segment: 'enterprise',
    description: 'For multi-location businesses with stricter governance needs',
    monthlyPrice: '₹8,000 / month',
    yearlyPrice: '₹80,000 / year',
    monthlyNote: 'Billed monthly',
    yearlyNote: 'Billed yearly, 2 months free',
    features: [
      'Up to 750 employees',
      'Role-based admin approvals',
      'Cross-branch payroll oversight',
    ],
  },
  {
    name: 'Corporate',
    segment: 'enterprise',
    description: 'For high-volume payroll operations that need operational resilience',
    monthlyPrice: '₹12,000 / month',
    yearlyPrice: '₹1,20,000 / year',
    monthlyNote: 'Billed monthly',
    yearlyNote: 'Billed yearly, 2 months free',
    features: [
      'Up to 1000 employees',
      'Centralized compliance workflows',
      'Executive reporting visibility',
    ],
  },
  {
    name: 'Custom Enterprise',
    segment: 'enterprise',
    custom: true,
    eyebrow: 'Customized requirements?',
    description:
      'Speak to us for custom workflows, volume-based pricing, migration planning, and rollout support tailored to your payroll operations.',
    monthlyPrice: '₹5,000 + ₹15 per employee',
    yearlyPrice: '₹50,000 + ₹150 per employee',
    monthlyNote: 'Billed monthly',
    yearlyNote: 'Billed yearly, custom scaling',
    features: [
      'Unlimited employees',
      'Custom scaling',
      'Dedicated support',
    ],
    ctaLabel: 'Enquire',
  },
];

type SectionProps = {
  eyebrow?: string;
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

function LandingSection({
  eyebrow,
  id,
  title,
  description,
  children,
}: SectionProps) {
  return (
    <section className="landing-section" id={id}>
      <div className="landing-shell">
        <div className="landing-section-heading">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export function Home() {
  const tenant = useTenantStore((state) => state.tenant);
  const [pricingSegment, setPricingSegment] = useState<PricingSegment>('smb');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [isSubmittingEnquiry, setIsSubmittingEnquiry] = useState(false);
  const [enquiryNotice, setEnquiryNotice] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  usePageTitle('Worknest');

  const visiblePricingTiers = pricingTiers.filter(
    (plan) => plan.segment === pricingSegment,
  );
  const standardPricingTiers = visiblePricingTiers.filter((plan) => !plan.custom);
  const customEnterprisePlan = visiblePricingTiers.find((plan) => plan.custom) ?? null;

  async function handleDemoRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      company_name: String(formData.get('companyName') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      message: String(formData.get('message') ?? '').trim(),
    };

    if (
      payload.name === '' ||
      payload.company_name === '' ||
      payload.email === '' ||
      payload.phone === '' ||
      payload.message === ''
    ) {
      setEnquiryNotice({
        tone: 'error',
        message: 'Please complete all enquiry fields before submitting.',
      });
      return;
    }

    setIsSubmittingEnquiry(true);
    setEnquiryNotice(null);

    try {
      await submitContactEnquiry(payload);
      form.reset();
      setEnquiryNotice({
        tone: 'success',
        message: 'Thanks. Your enquiry has been sent and we will get in touch soon.',
      });
    } catch (error) {
      setEnquiryNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'We could not send your enquiry right now. Please try again.',
      });
    } finally {
      setIsSubmittingEnquiry(false);
    }
  }

  return (
    <AppLayout fullWidth tenant={tenant}>
      <div className="landing-page">
        <section
          className="landing-hero-band"
          id="top"
          aria-labelledby="landing-title"
        >
          <div className="landing-shell landing-hero">
            <div className="landing-hero-copy">
              <p className="eyebrow">Payroll Operations, Simplified</p>
              <h1 id="landing-title">
                Run payroll. Publish payslips. Without the chaos.
              </h1>
              <p className="landing-hero-text">
                Worknest helps you onboard your company, manage branches, upload
                payroll in minutes, and let employees securely access their
                payslips.
              </p>
              <div className="landing-hero-actions">
                <a className="button button-primary" href="#contact">
                  Enquire
                </a>
              </div>
            </div>

            <div className="landing-hero-visual" aria-hidden="true">
              <div className="hero-surface">
                <div className="hero-surface-top">
                  <span>Worknest Console</span>
                  <strong>Payroll status</strong>
                </div>
                <img
                  src="/images/hero-new.png"
                  alt=""
                  className="hero-surface-image"
                />
                <div className="hero-surface-summary">
                  <div>
                    <span>Branches</span>
                    <strong>12 active</strong>
                  </div>
                  <div>
                    <span>Payslips</span>
                    <strong>Published in minutes</strong>
                  </div>
                </div>
              </div>
              <div className="hero-floating-card hero-floating-card-left">
                <span>Uploads</span>
                <strong>Versioned payroll runs</strong>
              </div>
              <div className="hero-floating-card hero-floating-card-right">
                <span>Employees</span>
                <strong>Secure self-service access</strong>
              </div>
            </div>
          </div>
        </section>

        <LandingSection
          title="Payroll shouldn’t feel like a monthly crisis"
          description="When payroll lives across spreadsheets, chats, and scattered approvals, every cycle gets slower, noisier, and harder to trust."
        >
          <div className="problem-grid">
            {problemPoints.map((problem) => (
              <article className="problem-card" key={problem.label}>
                <span
                  className={`problem-card-mark ${problem.iconClass}`}
                  aria-hidden="true"
                />
                <h3>{problem.label}</h3>
              </article>
            ))}
          </div>
        </LandingSection>

        <LandingSection
          id="features"
          title="One system to manage it all"
          description="Worknest brings setup, payroll operations, and employee access into one clean workflow built for growing teams."
        >
          <div className="solution-grid">
            {solutionBlocks.map((block) => (
              <article className="solution-card" key={block.title}>
                <div
                  className={`solution-card-icon ${block.iconClass}`}
                  aria-hidden="true"
                />
                <h3>{block.title}</h3>
                <p>{block.description}</p>
              </article>
            ))}
          </div>
        </LandingSection>

        <LandingSection
          title="From upload to payslip in minutes"
          description="The workflow is built to stay simple from company setup to employee delivery."
        >
          <div className="steps-grid">
            {steps.map((step) => (
              <article className="step-card" key={step.label}>
                <span
                  className={`step-number ${step.iconClass}`}
                  aria-hidden="true"
                />
                <h3>{step.label}</h3>
              </article>
            ))}
          </div>
        </LandingSection>

        <LandingSection
          id="pricing"
          title="Simple pricing. No surprises"
          description="Start small, stay predictable, and scale payroll operations without hidden platform complexity."
        >
          <div className="pricing-toolbar">
            <div className="pricing-tabs" aria-label="Pricing segment">
              <button
                className={
                  pricingSegment === 'smb'
                    ? 'pricing-tab pricing-tab-active'
                    : 'pricing-tab'
                }
                onClick={() => setPricingSegment('smb')}
                type="button"
              >
                SMB
              </button>
              <button
                className={
                  pricingSegment === 'enterprise'
                    ? 'pricing-tab pricing-tab-active'
                    : 'pricing-tab'
                }
                onClick={() => setPricingSegment('enterprise')}
                type="button"
              >
                Enterprise
              </button>
            </div>

            <button
              aria-label="Toggle yearly billing"
              aria-pressed={billingCycle === 'yearly'}
              className={
                billingCycle === 'yearly'
                  ? 'pricing-billing-toggle pricing-billing-toggle-yearly'
                  : 'pricing-billing-toggle'
              }
              onClick={() =>
                setBillingCycle((current) =>
                  current === 'monthly' ? 'yearly' : 'monthly',
                )
              }
              type="button"
            >
              <span className="pricing-billing-label">Monthly</span>
              <span className="pricing-billing-track" aria-hidden="true">
                <span className="pricing-billing-thumb" />
              </span>
              <span className="pricing-billing-label">Yearly</span>
            </button>
          </div>

          <div className="pricing-grid">
            {standardPricingTiers.map((tier) => (
              <article
                className={
                  tier.highlighted ? 'pricing-card pricing-card-featured' : 'pricing-card'
                }
                key={tier.name}
              >
                <div className="pricing-card-top">
                  <div>
                    <span className="pricing-card-name">{tier.name}</span>
                    {tier.label ? (
                      <p className="pricing-card-badge">{tier.label}</p>
                    ) : null}
                  </div>
                  <strong>
                    {billingCycle === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice}
                  </strong>
                </div>
                <p className="pricing-card-billing">
                  {billingCycle === 'monthly' ? tier.monthlyNote : tier.yearlyNote}
                </p>
                <p className="pricing-card-description">{tier.description}</p>
                <div className="pricing-card-divider" />
                <div className="pricing-card-features">
                  {tier.features.map((feature) => (
                    <div className="pricing-card-feature" key={feature}>
                      <span className="pricing-card-check" aria-hidden="true">
                        ✓
                      </span>
                      <p>{feature}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {customEnterprisePlan ? (
            <article className="custom-pricing-card">
              <div className="custom-pricing-copy">
                <p className="eyebrow">
                  {customEnterprisePlan.eyebrow ?? customEnterprisePlan.name}
                </p>
                <h3>
                  {billingCycle === 'monthly'
                    ? customEnterprisePlan.monthlyPrice
                    : customEnterprisePlan.yearlyPrice}
                </h3>
                <p className="pricing-card-billing">
                  {billingCycle === 'monthly'
                    ? customEnterprisePlan.monthlyNote
                    : customEnterprisePlan.yearlyNote}
                </p>
                <p>{customEnterprisePlan.description}</p>
              </div>
              <div className="custom-pricing-features">
                {customEnterprisePlan.features.map((feature) => (
                  <div className="pricing-card-feature" key={feature}>
                    <span className="pricing-card-check" aria-hidden="true">
                      ✓
                    </span>
                    <p>{feature}</p>
                  </div>
                ))}
              </div>
              <a className="button button-primary custom-pricing-action" href="#contact">
                {customEnterprisePlan.ctaLabel ?? 'Enquire'}
              </a>
            </article>
          ) : null}

        </LandingSection>

        <LandingSection
          id="contact"
          title="Enquire"
          description="Tell us about your payroll setup and we’ll get in touch with the right next step."
        >
          <form className="enquiry-form" onSubmit={handleDemoRequest}>
            <label>
              <span>Name</span>
              <input name="name" placeholder="Your name" type="text" />
            </label>
            <label>
              <span>Company Name</span>
              <input
                name="companyName"
                placeholder="Your company"
                type="text"
              />
            </label>
            <label>
              <span>Email</span>
              <input
                name="email"
                placeholder="name@company.com"
                type="email"
              />
            </label>
            <label>
              <span>Phone</span>
              <input name="phone" placeholder="+91 98765 43210" type="tel" />
            </label>
            <label className="enquiry-form-message">
              <span>Message</span>
              <textarea
                name="message"
                placeholder="Tell us about your payroll process, team size, or branch setup."
                rows={5}
              />
            </label>
            <div className="enquiry-form-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={isSubmittingEnquiry}
              >
                {isSubmittingEnquiry ? 'Sending...' : 'Enquire'}
              </button>
              {enquiryNotice ? (
                <p
                  className={
                    enquiryNotice.tone === 'success'
                      ? 'enquiry-form-notice enquiry-form-notice-success'
                      : 'enquiry-form-notice enquiry-form-notice-error'
                  }
                >
                  {enquiryNotice.message}
                </p>
              ) : null}
            </div>
          </form>
        </LandingSection>

        <footer className="landing-footer">
          <div className="landing-shell landing-footer-shell">
            <div className="landing-footer-brand" aria-label="Worknest">
              <img
                className="landing-footer-brand-logo"
                src="/images/worknest-logo.png"
                alt="Worknest"
              />
            </div>
            <nav aria-label="Footer navigation" className="landing-footer-nav">
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#contact">Contact</a>
              <Link to="/login">Login</Link>
            </nav>
          </div>
        </footer>
      </div>
    </AppLayout>
  );
}
