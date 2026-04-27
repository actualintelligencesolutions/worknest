import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppLayout } from '../../layouts/AppLayout';
import { useTenantStore } from '../../stores/tenantStore';
import './style.scss';

export function Home() {
  const tenant = useTenantStore((state) => state.tenant);
  usePageTitle('Home');

  return (
    <AppLayout tenant={tenant}>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="eyebrow">Free company setup</p>
          <h1 id="landing-title">
            Register your company first. Build the workplace from there.
          </h1>
          <p>
            Start with a company profile using only the company name and admin
            email. After login, HR can initialize the Head Office and add
            branches when the structure is ready.
          </p>
          <Link className="button button-primary landing-cta" to="/register">
            Register Now
          </Link>
        </div>

        <div className="landing-hero-art">
          <img
            src="/images/hero-new.png"
            alt="Worknest company workspace setup"
          />
        </div>
      </section>
    </AppLayout>
  );
}
