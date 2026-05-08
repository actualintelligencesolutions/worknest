import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/atoms/Button';
import { Field } from '../../../components/atoms/Field';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AppLayout } from '../../../layouts/AppLayout';
import { saveEmployeeSession } from '../../../services/employeeSession';
import { loginEmployee } from '../../../services/worknestApi';
import { useTenantStore } from '../../../stores/tenantStore';
import '../shared.scss';

export function EmployeeLoginPage() {
  usePageTitle('Employee payslips');
  const tenant = useTenantStore((state) => state.tenant);
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState(tenant.tenantId);
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantId.trim() || !employeeId.trim() || !pin.trim()) {
      setNotice('Workspace, employee ID, and PIN are required.');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await loginEmployee(tenantId.trim(), {
        employee_id: employeeId.trim(),
        pin: pin.trim(),
      });

      saveEmployeeSession({
        token: response.token,
        tenantId: tenantId.trim(),
        userName: response.user.name,
      });

      navigate('/employee/payslips');
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout tenant={tenant}>
      <div className="employee-shell">
        <div className="employee-stack">
          <section className="employee-panel">
            <h1>Employee payslip access</h1>
            <p>
              Sign in with your workspace, employee ID, and PIN to view published payslips.
            </p>
          </section>

          {notice ? <div className="employee-notice error">{notice}</div> : null}

          <section className="employee-panel">
            <form className="employee-form" onSubmit={handleSubmit}>
              <Field label="Workspace">
                <input
                  autoComplete="organization"
                  onChange={(event) => setTenantId(event.target.value.toLowerCase())}
                  placeholder="acme"
                  value={tenantId}
                />
              </Field>
              <Field label="Employee ID">
                <input
                  autoComplete="username"
                  onChange={(event) => setEmployeeId(event.target.value)}
                  placeholder="EMP-1042"
                  value={employeeId}
                />
              </Field>
              <Field label="PIN">
                <input
                  autoComplete="current-password"
                  inputMode="numeric"
                  onChange={(event) => setPin(event.target.value)}
                  placeholder="••••"
                  type="password"
                  value={pin}
                />
              </Field>
              <div className="employee-actions">
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Signing in...' : 'View payslips'}
                </Button>
                <Button as={Link} to="/login" variant="secondary">
                  Admin login
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
