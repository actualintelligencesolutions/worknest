import { Link } from 'react-router-dom';
import { AppLayout } from '../../layouts/AppLayout';
import { useTenantStore } from '../../stores/tenantStore';
import './style.scss';

export function Home() {
  const tenant = useTenantStore((state) => state.tenant);

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
            Register company free
          </Link>
        </div>

        <div className="company-model" aria-label="Company setup model">
          <div className="model-node model-node-company">
            <span>1</span>
            <strong>Company</strong>
            <small>Created first as the main profile.</small>
          </div>
          <div className="model-connector" aria-hidden="true" />
          <div className="model-node model-node-office">
            <span>2</span>
            <strong>Head Office</strong>
            <small>Initialized after admin or HR login.</small>
          </div>
          <div className="model-connector" aria-hidden="true" />
          <div className="branch-row">
            <div className="model-node model-node-branch">
              <span>3</span>
              <strong>Branch</strong>
              <small>Add when needed.</small>
            </div>
            <div className="model-node model-node-branch">
              <span>+</span>
              <strong>Branches</strong>
              <small>Grow from the Head Office.</small>
            </div>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
