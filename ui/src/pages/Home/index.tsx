import { useState } from 'react';
import { MarketingLayout } from '../../layouts/MarketingLayout';
import './style.scss';

const problems = [
  'Excel everywhere, no control',
  'Payslips sent manually or via WhatsApp',
  'No central system for branches',
  'Employees constantly asking for payslips',
];

const features = [
  {
    title: 'Company & Branch Setup',
    description:
      'Create your main company workspace, add branches as you grow, and keep every team inside one structured payroll system.',
  },
  {
    title: 'Payroll Upload & Processing',
    description:
      'Upload payroll sheets in minutes, validate the data before publishing, and keep each payroll cycle organized and traceable.',
  },
  {
    title: 'Employee Self-Service Portal',
    description:
      'Give employees a secure place to access payslips instantly without depending on HR for every request.',
  },
];

const workflow = [
  {
    title: 'Register your company',
    description:
      'Create your main workspace with the right company details and get payroll operations started in one place.',
  },
  {
    title: 'Add branches',
    description:
      'Set up branch locations as your team grows so every payroll run maps cleanly to the right office structure.',
  },
  {
    title: 'Upload payroll sheet',
    description:
      'Bring in your payroll file in minutes instead of rebuilding the same information every month.',
  },
  {
    title: 'Preview and validate',
    description:
      'Catch issues before publishing with a clear review step that helps your team trust the data.',
  },
  {
    title: 'Publish payslips',
    description:
      'Finalize the payroll cycle and generate payslips through one controlled, trackable workflow.',
  },
  {
    title: 'Employees access instantly',
    description:
      'Give employees secure self-service access so HR is no longer answering the same payslip requests manually.',
  },
];

type Plan = {
  name: string;
  price: string;
  note: string;
  description: string;
  features: string[];
  badge?: string;
};

type PricingInfo = {
  title: string;
  price: string;
  note: string;
  description: string;
  features: string[];
  ctaLabel: string;
};

type BusinessTier = 'smb' | 'enterprise';
type BillingCycle = 'monthly' | 'yearly';

const pricingPlans: Record<BusinessTier, Record<BillingCycle, Plan[]>> = {
  smb: {
    monthly: [
      {
        name: 'Starter',
        price: 'Free',
        note: 'Billed monthly',
        description: 'Perfect for small teams getting started',
        features: ['Up to 20 employees', 'Payslip generation', 'Employee login with PIN'],
      },
      {
        name: 'Basic',
        price: '₹500 / month',
        note: 'Billed monthly',
        description: 'For small growing teams',
        features: ['Up to 50 employees', 'Payroll upload & preview', 'Everything in Starter'],
      },
      {
        name: 'Growth',
        price: '₹1,000 / month',
        note: 'Billed monthly',
        badge: 'Most Popular',
        description: 'Best for teams scaling payroll across locations',
        features: [
          'Up to 100 employees',
          'Branch-wise payroll',
          'Versioned payroll uploads',
          'Everything in Basic',
        ],
      },
      {
        name: 'Scale',
        price: '₹3,000 / month',
        note: 'Billed monthly',
        description: 'For larger operations that need more control',
        features: ['Up to 300 employees', 'Priority processing', 'Advanced payroll tracking'],
      },
    ],
    yearly: [
      {
        name: 'Starter',
        price: 'Free',
        note: 'Billed yearly',
        description: 'Perfect for small teams getting started',
        features: ['Up to 20 employees', 'Payslip generation', 'Employee login with PIN'],
      },
      {
        name: 'Basic',
        price: '₹5,000 / year',
        note: 'Billed yearly, 2 months free',
        description: 'For small growing teams',
        features: ['Up to 50 employees', 'Payroll upload & preview', 'Everything in Starter'],
      },
      {
        name: 'Growth',
        price: '₹10,000 / year',
        note: 'Billed yearly, 2 months free',
        badge: 'Most Popular',
        description: 'Best for teams scaling payroll across locations',
        features: [
          'Up to 100 employees',
          'Branch-wise payroll',
          'Versioned payroll uploads',
          'Everything in Basic',
        ],
      },
      {
        name: 'Scale',
        price: '₹30,000 / year',
        note: 'Billed yearly, 2 months free',
        description: 'For larger operations that need more control',
        features: ['Up to 300 employees', 'Priority processing', 'Advanced payroll tracking'],
      },
    ],
  },
  enterprise: {
    monthly: [
      {
        name: 'Enterprise',
        price: '₹5,000 / month',
        note: 'Billed monthly',
        description: 'Operational oversight for large payroll teams',
        features: ['Up to 500 employees', 'Admin controls', 'Audit logs'],
      },
      {
        name: 'Enterprise Plus',
        price: '₹8,000 / month',
        note: 'Billed monthly',
        badge: 'Most Popular',
        description: 'For multi-location businesses with stricter governance needs',
        features: [
          'Up to 750 employees',
          'Role-based admin approvals',
          'Cross-branch payroll oversight',
        ],
      },
      {
        name: 'Corporate',
        price: '₹12,000 / month',
        note: 'Billed monthly',
        description: 'For high-volume payroll operations that need operational resilience',
        features: [
          'Up to 1000 employees',
          'Centralized compliance workflows',
          'Executive reporting visibility',
        ],
      },
    ],
    yearly: [
      {
        name: 'Enterprise',
        price: '₹50,000 / year',
        note: 'Billed yearly, 2 months free',
        description: 'Operational oversight for large payroll teams',
        features: ['Up to 500 employees', 'Admin controls', 'Audit logs'],
      },
      {
        name: 'Enterprise Plus',
        price: '₹80,000 / year',
        note: 'Billed yearly, 2 months free',
        badge: 'Most Popular',
        description: 'For multi-location businesses with stricter governance needs',
        features: [
          'Up to 750 employees',
          'Role-based admin approvals',
          'Cross-branch payroll oversight',
        ],
      },
      {
        name: 'Corporate',
        price: '₹1,20,000 / year',
        note: 'Billed yearly, 2 months free',
        description: 'For high-volume payroll operations that need operational resilience',
        features: [
          'Up to 1000 employees',
          'Centralized compliance workflows',
          'Executive reporting visibility',
        ],
      },
    ],
  },
};

const enterprisePricingInfo: Record<BillingCycle, PricingInfo> = {
  monthly: {
    title: 'Customized requirements?',
    price: '₹5,000 + ₹150 per employee',
    note: 'Billed monthly, custom scaling',
    description:
      'Speak to us for custom workflows, volume-based pricing, migration planning, and rollout support tailored to your payroll operations.',
    features: ['Unlimited employees', 'Custom scaling', 'Dedicated support'],
    ctaLabel: 'Enquire',
  },
  yearly: {
    title: 'Customized requirements?',
    price: '₹50,000 + ₹150 per employee',
    note: 'Billed yearly, custom scaling',
    description:
      'Speak to us for custom workflows, volume-based pricing, migration planning, and rollout support tailored to your payroll operations.',
    features: ['Unlimited employees', 'Custom scaling', 'Dedicated support'],
    ctaLabel: 'Enquire',
  },
};

const footerLinks = ['Features', 'Pricing', 'Contact', 'Login'];

export function HomePage() {
  const [businessTier, setBusinessTier] = useState<BusinessTier>('smb');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const plans = pricingPlans[businessTier][billingCycle];
  const pricingInfo =
    businessTier === 'enterprise' ? enterprisePricingInfo[billingCycle] : null;

  return (
    <MarketingLayout>
      <section className="marketing-hero" id="top">
        <div className="marketing-hero-shell">
          <div className="marketing-hero-orbit marketing-hero-orbit-one" />
          <div className="marketing-hero-orbit marketing-hero-orbit-two" />
          <div className="marketing-hero-orbit marketing-hero-orbit-three" />
          <div className="marketing-hero-haze marketing-hero-haze-top" />
          <div className="marketing-hero-haze marketing-hero-haze-bottom" />

          <div className="marketing-hero-content">
            <p className="marketing-hero-kicker">Payroll Operations, Simplified</p>
            <h1>Run payroll. Publish payslips. Without the chaos.</h1>
            <p className="marketing-hero-copy">
              Worknest helps you onboard your company, manage branches, upload payroll
              in minutes, and let employees securely access their payslips.
            </p>

            <div className="marketing-hero-actions">
              <a className="marketing-hero-secondary" href="/#contact">
                Enquire
              </a>
              <a className="marketing-hero-primary" href="/login">
                Try now
              </a>
            </div>
          </div>

          <div className="marketing-hero-badge marketing-hero-badge-left">
            <span>12</span>
            <small>Branches active</small>
          </div>
          <div className="marketing-hero-badge marketing-hero-badge-right">
            <span>✓</span>
            <small>Payslips published in minutes</small>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-stats" id="features">
        <div className="marketing-shell marketing-stat-grid">
          <article className="marketing-stat">
            <p>Branches</p>
            <strong>12 active</strong>
          </article>
          <article className="marketing-stat">
            <p>Uploads</p>
            <strong>Versioned payroll runs</strong>
          </article>
          <article className="marketing-stat">
            <p>Employees</p>
            <strong>Secure self-service access</strong>
          </article>
        </div>
      </section>

      <section className="marketing-section marketing-problem">
        <div className="marketing-shell marketing-section-grid">
          <div className="marketing-section-intro">
            <p className="marketing-section-kicker">Payroll shouldn’t feel like a monthly crisis</p>
            <h2>Why payroll breaks down</h2>
          </div>

          <div className="marketing-section-column">
            <p className="marketing-section-description">
              When payroll lives across spreadsheets, chats, and scattered approvals,
              every cycle gets slower, noisier, and harder to trust.
            </p>

            <div className="marketing-list-block">
            {problems.map((problem) => (
              <div className="marketing-list-row" key={problem}>
                <span />
                <p>{problem}</p>
              </div>
            ))}
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-features">
        <div className="marketing-shell marketing-section-grid marketing-section-grid-reversed">
          <div className="marketing-section-column">
            <p className="marketing-section-description">
                Worknest brings setup, payroll operations, and employee access into one
                clean workflow built for growing teams.
            </p>

            <div className="marketing-feature-list">
              {features.map((feature) => (
                <article className="marketing-feature-row" key={feature.title}>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="marketing-section-intro">
            <p className="marketing-section-kicker">One system to manage it all</p>
            <h2>Everything in one workflow</h2>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-workflow" id="workflow">
        <div className="marketing-shell marketing-section-centered">
          <div className="marketing-section-intro marketing-section-intro-centered">
            <p className="marketing-section-kicker">From upload to payslip in minutes</p>
            <h2>How it works</h2>
            <p className="marketing-section-description marketing-section-description-centered">
              The workflow is built to stay simple from company setup to employee
              delivery.
            </p>
          </div>

          <div className="marketing-section-column marketing-section-column-centered">
            <div className="marketing-workflow-grid">
              {workflow.map((step, index) => (
                <div className="marketing-workflow-step" key={step.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{step.title}</p>
                  <small>{step.description}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-pricing" id="pricing">
        <div className="marketing-shell marketing-section-centered">
          <div className="marketing-section-intro marketing-section-intro-centered">
            <p className="marketing-section-kicker">Simple pricing. No surprises</p>
            <h2>Pricing that scales</h2>
            <p className="marketing-section-description marketing-section-description-centered">
              Start small, stay predictable, and scale payroll operations without
              hidden platform complexity.
            </p>
          </div>

          <div className="marketing-section-column marketing-section-column-centered">
            <div className="marketing-pricing-controls">
              <div className="marketing-toggle">
                <button
                  className={businessTier === 'smb' ? 'active' : undefined}
                  onClick={() => setBusinessTier('smb')}
                  type="button"
                >
                  SMB
                </button>
                <button
                  className={businessTier === 'enterprise' ? 'active' : undefined}
                  onClick={() => setBusinessTier('enterprise')}
                  type="button"
                >
                  Enterprise
                </button>
              </div>
              <div className="marketing-toggle">
                <button
                  className={billingCycle === 'monthly' ? 'active' : undefined}
                  onClick={() => setBillingCycle('monthly')}
                  type="button"
                >
                  Monthly
                </button>
                <button
                  className={billingCycle === 'yearly' ? 'active' : undefined}
                  onClick={() => setBillingCycle('yearly')}
                  type="button"
                >
                  Yearly
                </button>
              </div>
            </div>

            <div className="marketing-plan-grid">
              {plans.map((plan) => (
                <article
                  className={plan.badge ? 'marketing-plan marketing-plan-featured' : 'marketing-plan'}
                  key={plan.name}
                >
                  <div className="marketing-plan-head">
                    <div>
                      <h3>{plan.name}</h3>
                      {plan.badge ? <em>{plan.badge}</em> : null}
                    </div>
                    <strong>{plan.price}</strong>
                  </div>
                  <p className="marketing-plan-note">{plan.note}</p>
                  <p className="marketing-plan-description">{plan.description}</p>
                  <div className="marketing-plan-divider" />
                  <ul className="marketing-plan-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            {pricingInfo ? (
              <div className="marketing-pricing-info">
                <div className="marketing-pricing-info-head">
                  <div>
                    <h3>{pricingInfo.title}</h3>
                    <p className="marketing-plan-note">{pricingInfo.note}</p>
                  </div>
                  <strong>{pricingInfo.price}</strong>
                </div>
                <p className="marketing-pricing-info-description">
                  {pricingInfo.description}
                </p>
                <ul className="marketing-pricing-info-list">
                  {pricingInfo.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <a className="marketing-plan-link" href="/#contact">
                  {pricingInfo.ctaLabel}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-contact" id="contact">
        <div className="marketing-shell marketing-section-grid">
          <div className="marketing-section-intro">
            <p className="marketing-section-kicker">Enquire</p>
            <h2>Let’s talk payroll</h2>
            <p className="marketing-section-description">
              Tell us about your payroll setup and we’ll get in touch with the right
              next step.
            </p>
          </div>

          <div className="marketing-section-column">
            <form className="marketing-form">
              <label>
                <span>Name</span>
                <input placeholder="Your name" type="text" />
              </label>
              <label>
                <span>Company Name</span>
                <input placeholder="Your company" type="text" />
              </label>
              <label>
                <span>Email</span>
                <input placeholder="name@company.com" type="email" />
              </label>
              <label>
                <span>Phone</span>
                <input placeholder="+91 98765 43210" type="tel" />
              </label>
              <label className="marketing-form-full">
                <span>Message</span>
                <textarea
                  placeholder="Tell us about your payroll process, team size, or branch setup."
                  rows={5}
                />
              </label>
              <div className="marketing-form-full">
                <button className="marketing-submit" type="button">
                  Enquire
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <footer className="marketing-footer" id="login">
        <div className="marketing-shell marketing-footer-shell">
          <a className="marketing-footer-brand" href="#top">
            Worknest
          </a>
          <div className="marketing-footer-links">
            {footerLinks.map((link) => (
              <a
                href={
                  link === 'Login'
                    ? '/login'
                    : `/#${link.toLowerCase()}`
                }
                key={link}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </MarketingLayout>
  );
}
