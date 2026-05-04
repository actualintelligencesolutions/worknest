import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/atoms/Button';
import { Field } from '../../../components/atoms/Field';
import { DataTable } from '../../../components/organisms/DataTable';
import { EmptyState } from '../../../components/organisms/EmptyState';
import { PageSection } from '../../../components/organisms/PageSection';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AdminLayout } from '../../../layouts/AdminLayout';
import { loadHrSession } from '../../../services/hrSession';
import {
  createBranch,
  createMainOffice,
  listCompanyLocations,
  listPlans,
  type Plan,
} from '../../../services/worknestApi';
import '../shared.scss';

type Notice = {
  kind: 'success' | 'error';
  message: string;
};

export function OfficesPage() {
  usePageTitle('Offices');
  const session = loadHrSession();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedType = searchParams.get('type') === 'branch' ? 'branch' : 'main';
  const [type, setType] = useState<'main' | 'branch'>(requestedType);
  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [planId, setPlanId] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const locationsQuery = useQuery({
    queryKey: ['locations', session?.tenantId],
    queryFn: () => listCompanyLocations(session!),
    enabled: Boolean(session),
  });

  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });

  const locations = locationsQuery.data?.locations ?? [];
  const plans = plansQuery.data?.plans ?? [];
  const hasMainOffice = useMemo(
    () => locations.some((location) => location.location_type === 'main_office'),
    [locations],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !planId) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      if (type === 'main') {
        await createMainOffice(session, {
          name: name.trim() || 'Main Office',
          admin_name: adminName.trim() || undefined,
          admin_email: adminEmail.trim() || undefined,
          plan_id: Number(planId),
          city: city.trim() || undefined,
          state: state.trim() || undefined,
        });
      } else {
        await createBranch(session, {
          branch_name: name.trim(),
          admin_name: adminName.trim() || undefined,
          admin_email: adminEmail.trim() || undefined,
          plan_id: Number(planId),
          city: city.trim() || undefined,
          state: state.trim() || undefined,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['locations', session.tenantId] });
      setNotice({
        kind: 'success',
        message: type === 'main' ? 'Main office created.' : 'Branch created.',
      });
      setName('');
      setAdminName('');
      setAdminEmail('');
      setCity('');
      setState('');
    } catch (error) {
      setNotice({ kind: 'error', message: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleTypeChange(nextType: 'main' | 'branch') {
    setType(nextType);
    setSearchParams(nextType === 'branch' ? { type: 'branch' } : {});
  }

  return (
    <AdminLayout
      title="Offices"
      subtitle="Manage the main office, branches, and office-level plans."
    >
      <div className="app-grid-two">
        <PageSection
          title="Create office"
          description="A minimal form for main office and branch setup."
        >
          {notice ? (
            <div className={`app-notice ${notice.kind}`}>{notice.message}</div>
          ) : null}
          <form className="app-card app-inline-form" onSubmit={handleSubmit}>
            <Field label="Office type">
              <select
                onChange={(event) =>
                  handleTypeChange(event.target.value === 'branch' ? 'branch' : 'main')
                }
                value={type}
              >
                <option disabled={hasMainOffice} value="main">
                  Main office
                </option>
                <option value="branch">Branch</option>
              </select>
            </Field>

            <Field label={type === 'main' ? 'Office name' : 'Branch name'}>
              <input
                onChange={(event) => setName(event.target.value)}
                placeholder={type === 'main' ? 'Main Office' : 'Bengaluru Branch'}
                value={name}
              />
            </Field>

            <Field label="Plan">
              <select onChange={(event) => setPlanId(event.target.value)} value={planId}>
                <option value="">Select plan</option>
                {plans.map((plan: Plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Admin name">
              <input
                onChange={(event) => setAdminName(event.target.value)}
                placeholder="Optional"
                value={adminName}
              />
            </Field>

            <Field label="Admin email">
              <input
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="Optional"
                type="email"
                value={adminEmail}
              />
            </Field>

            <div className="app-grid-two">
              <Field label="City">
                <input onChange={(event) => setCity(event.target.value)} value={city} />
              </Field>
              <Field label="State">
                <input onChange={(event) => setState(event.target.value)} value={state} />
              </Field>
            </div>

            <Button disabled={isSubmitting || !planId || (type === 'branch' && !name.trim())}>
              {isSubmitting ? 'Saving...' : type === 'main' ? 'Create main office' : 'Create branch'}
            </Button>
          </form>
        </PageSection>

        <PageSection title="Existing offices" description="Current workspace office structure.">
          {locations.length === 0 ? (
            <EmptyState
              title="No offices yet"
              message="Create your main office first, then add branches as needed."
            />
          ) : (
            <DataTable columns={['Office', 'Type', 'Status', 'Open']}>
              {locations.map((location) => (
                <tr key={location.id}>
                  <td>{location.name}</td>
                  <td>{location.location_type?.replace('_', ' ') ?? 'office'}</td>
                  <td>
                    <span className={`app-status ${location.status}`}>
                      {location.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <Link className="app-link" to={`/app/offices/${location.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </PageSection>
      </div>
    </AdminLayout>
  );
}
