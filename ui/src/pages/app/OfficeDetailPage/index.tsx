import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../../components/atoms/Button';
import { Field } from '../../../components/atoms/Field';
import { DataTable } from '../../../components/organisms/DataTable';
import { EmptyState } from '../../../components/organisms/EmptyState';
import { PageSection } from '../../../components/organisms/PageSection';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AdminLayout } from '../../../layouts/AdminLayout';
import { loadHrSession } from '../../../services/hrSession';
import {
  assignOfficeAdmins,
  assignOfficePlan,
  getOffice,
  listPlans,
  listUsers,
  updateOffice,
} from '../../../services/worknestApi';
import '../shared.scss';

export function OfficeDetailPage() {
  const session = loadHrSession();
  const queryClient = useQueryClient();
  const { id = '' } = useParams();
  const officeId = Number(id);
  usePageTitle('Office detail');

  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [planId, setPlanId] = useState('');
  const [selectedAdminIds, setSelectedAdminIds] = useState<number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const officeQuery = useQuery({
    queryKey: ['office', session?.tenantId, officeId],
    queryFn: () => getOffice(session!, officeId),
    enabled: Boolean(session && officeId),
  });

  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });

  const usersQuery = useQuery({
    queryKey: ['users', session?.tenantId, 'branch_admin'],
    queryFn: () => listUsers(session!, { user_type: 'branch_admin' }),
    enabled: Boolean(session),
  });

  const office = officeQuery.data?.location ?? officeQuery.data?.office;

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !officeId) {
      return;
    }

    try {
      await updateOffice(session, officeId, {
        status: status || office?.status,
        city: city || office?.city,
        state: stateValue || office?.state,
      });
      await queryClient.invalidateQueries({ queryKey: ['office', session.tenantId, officeId] });
      setNotice('Office details updated.');
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function handleAssignPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !planId) {
      return;
    }

    try {
      await assignOfficePlan(session, officeId, Number(planId));
      await queryClient.invalidateQueries({ queryKey: ['office', session.tenantId, officeId] });
      setNotice('Plan assignment updated.');
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function handleAssignAdmins(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || selectedAdminIds.length === 0) {
      return;
    }

    try {
      await assignOfficeAdmins(session, officeId, selectedAdminIds);
      setNotice('Admin assignment saved.');
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  return (
    <AdminLayout
      title={office?.name ?? 'Office detail'}
      subtitle="Minimal office detail, plan, and admin assignment view."
      actions={
        <Button as={Link} to="/app/offices" variant="secondary">
          Back to offices
        </Button>
      }
    >
      <div className="app-grid">
        {notice ? <div className="app-notice">{notice}</div> : null}

        {!office ? (
          <EmptyState
            title="Office not found"
            message="We could not load this office from the backend."
          />
        ) : (
          <>
            <div className="app-grid-three">
              <div className="app-card">
                <h3>Type</h3>
                <p>{office.location_type ?? office.office_type ?? 'office'}</p>
              </div>
              <div className="app-card">
                <h3>Status</h3>
                <p>{office.status}</p>
              </div>
              <div className="app-card">
                <h3>Plan</h3>
                <p>{officeQuery.data?.plan.name ?? 'No plan assigned'}</p>
              </div>
            </div>

            <div className="app-grid-two">
              <PageSection title="Office settings">
                <form className="app-card app-inline-form" onSubmit={handleUpdate}>
                  <Field label="Status">
                    <select onChange={(event) => setStatus(event.target.value)} value={status}>
                      <option value="">Keep current</option>
                      <option value="active">Active</option>
                      <option value="pending_setup">Pending setup</option>
                      <option value="suspended">Suspended</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </Field>
                  <Field label="City">
                    <input
                      onChange={(event) => setCity(event.target.value)}
                      placeholder={office.city ?? ''}
                      value={city}
                    />
                  </Field>
                  <Field label="State">
                    <input
                      onChange={(event) => setStateValue(event.target.value)}
                      placeholder={office.state ?? ''}
                      value={stateValue}
                    />
                  </Field>
                  <Button>Save settings</Button>
                </form>
              </PageSection>

              <PageSection title="Assign plan">
                <form className="app-card app-inline-form" onSubmit={handleAssignPlan}>
                  <Field label="Plan">
                    <select onChange={(event) => setPlanId(event.target.value)} value={planId}>
                      <option value="">Select plan</option>
                      {(plansQuery.data?.plans ?? []).map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button disabled={!planId}>Assign plan</Button>
                </form>
              </PageSection>
            </div>

            <PageSection title="Assign branch admins">
              {(usersQuery.data?.users ?? []).length === 0 ? (
                <EmptyState
                  title="No branch admins available"
                  message="Create branch admin users first, then assign them to this office."
                />
              ) : (
                <form className="app-card app-inline-form" onSubmit={handleAssignAdmins}>
                  <Field label="Available branch admins">
                    <select
                      multiple
                      onChange={(event) => {
                        const values = Array.from(event.target.selectedOptions).map((option) =>
                          Number(option.value),
                        );
                        setSelectedAdminIds(values);
                      }}
                      value={selectedAdminIds.map(String)}
                    >
                      {(usersQuery.data?.users ?? []).map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.display_name ?? user.name ?? user.email ?? `User ${user.id}`}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button disabled={selectedAdminIds.length === 0}>Assign admins</Button>
                </form>
              )}
            </PageSection>

            <PageSection title="Backend detail snapshot">
              <DataTable columns={['Field', 'Value']}>
                <tr>
                  <td>Primary admin</td>
                  <td>{officeQuery.data?.admin?.name ?? 'Not set'}</td>
                </tr>
                <tr>
                  <td>Admin email</td>
                  <td>{officeQuery.data?.admin?.email ?? 'Not set'}</td>
                </tr>
                <tr>
                  <td>Plan code</td>
                  <td>{officeQuery.data?.plan.plan_code ?? 'Not set'}</td>
                </tr>
              </DataTable>
            </PageSection>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
