import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/atoms/Button';
import { Field } from '../../../components/atoms/Field';
import { DataTable } from '../../../components/organisms/DataTable';
import { EmptyState } from '../../../components/organisms/EmptyState';
import { PageSection } from '../../../components/organisms/PageSection';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { AdminLayout } from '../../../layouts/AdminLayout';
import { loadHrSession } from '../../../services/hrSession';
import {
  createUser,
  getUser,
  listCompanyLocations,
  listUsers,
  resetEmployeePin,
  updateUser,
  type UserRecord,
} from '../../../services/worknestApi';
import '../shared.scss';

export function UsersPage() {
  usePageTitle('Users');
  const session = loadHrSession();
  const queryClient = useQueryClient();
  const [officeFilter, setOfficeFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userType, setUserType] = useState<'branch_admin' | 'employee'>('employee');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [password, setPassword] = useState('');
  const [initialPin, setInitialPin] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [newPin, setNewPin] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users', session?.tenantId, officeFilter, roleFilter],
    queryFn: () =>
      listUsers(session!, {
        office_id: officeFilter ? Number(officeFilter) : '',
        user_type: roleFilter,
      }),
    enabled: Boolean(session),
  });

  const locationsQuery = useQuery({
    queryKey: ['locations', session?.tenantId],
    queryFn: () => listCompanyLocations(session!),
    enabled: Boolean(session),
  });

  const selectedUserQuery = useQuery({
    queryKey: ['user', session?.tenantId, selectedUserId],
    queryFn: () => getUser(session!, selectedUserId!),
    enabled: Boolean(session && selectedUserId),
  });

  const users = usersQuery.data?.users ?? [];
  const locations = locationsQuery.data?.locations ?? [];
  const selectedUser = selectedUserQuery.data?.user;
  const officeOptions = useMemo(
    () => locations.filter((location) => location.location_type === 'branch'),
    [locations],
  );

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }

    try {
      await createUser(session, {
        user_type: userType,
        office_id: officeId ? Number(officeId) : undefined,
        first_name: firstName,
        last_name: lastName || undefined,
        display_name: [firstName, lastName].filter(Boolean).join(' '),
        email: email || undefined,
        phone: phone || undefined,
        employee_id: userType === 'employee' ? employeeId || undefined : undefined,
        password: userType === 'branch_admin' ? password || undefined : undefined,
        initial_pin: userType === 'employee' ? initialPin || undefined : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['users', session.tenantId] });
      setNotice('User created.');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setEmployeeId('');
      setPassword('');
      setInitialPin('');
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function handleUpdateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedUser) {
      return;
    }

    try {
      await updateUser(session, selectedUser.id, {
        status: editedStatus || selectedUser.status,
      });
      await queryClient.invalidateQueries({ queryKey: ['user', session.tenantId, selectedUser.id] });
      await queryClient.invalidateQueries({ queryKey: ['users', session.tenantId] });
      setNotice('User updated.');
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function handleResetPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedUser || !newPin.trim()) {
      return;
    }

    try {
      await resetEmployeePin(session, selectedUser.id, newPin.trim());
      setNotice('Employee PIN reset.');
      setNewPin('');
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  return (
    <AdminLayout
      title="Users"
      subtitle="Create and manage branch admins and employees."
    >
      <div className="app-grid">
        {notice ? <div className="app-notice">{notice}</div> : null}

        <div className="app-grid-two">
          <PageSection title="Create user">
            <form className="app-card app-inline-form" onSubmit={handleCreateUser}>
              <Field label="User type">
                <select
                  onChange={(event) =>
                    setUserType(
                      event.target.value === 'branch_admin' ? 'branch_admin' : 'employee',
                    )
                  }
                  value={userType}
                >
                  <option value="employee">Employee</option>
                  <option value="branch_admin">Branch admin</option>
                </select>
              </Field>

              <div className="app-grid-two">
                <Field label="First name">
                  <input onChange={(event) => setFirstName(event.target.value)} value={firstName} />
                </Field>
                <Field label="Last name">
                  <input onChange={(event) => setLastName(event.target.value)} value={lastName} />
                </Field>
              </div>

              <Field label="Branch office">
                <select onChange={(event) => setOfficeId(event.target.value)} value={officeId}>
                  <option value="">Select office</option>
                  {officeOptions.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Email">
                <input onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
              </Field>

              <Field label="Phone">
                <input onChange={(event) => setPhone(event.target.value)} value={phone} />
              </Field>

              {userType === 'employee' ? (
                <>
                  <Field label="Employee ID">
                    <input onChange={(event) => setEmployeeId(event.target.value)} value={employeeId} />
                  </Field>
                  <Field label="Initial PIN">
                    <input
                      onChange={(event) => setInitialPin(event.target.value)}
                      type="password"
                      value={initialPin}
                    />
                  </Field>
                </>
              ) : (
                <Field label="Temporary password">
                  <input
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    value={password}
                  />
                </Field>
              )}

              <Button disabled={!firstName.trim()}>Create user</Button>
            </form>
          </PageSection>

          <PageSection title="Users list">
            {users.length === 0 ? (
              <EmptyState
                title="No users found"
                message="Create a branch admin or employee to populate this view."
              />
            ) : (
              <>
                <div className="app-card app-grid-two">
                  <Field label="Office">
                    <select onChange={(event) => setOfficeFilter(event.target.value)} value={officeFilter}>
                      <option value="">All offices</option>
                      {officeOptions.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Role">
                    <select onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}>
                      <option value="">All roles</option>
                      <option value="branch_admin">Branch admin</option>
                      <option value="employee">Employee</option>
                    </select>
                  </Field>
                </div>

                <DataTable columns={['Name', 'Role', 'Office', 'Status']}>
                  {users.map((user: UserRecord) => (
                    <tr key={user.id} onClick={() => setSelectedUserId(user.id)}>
                      <td>{user.display_name ?? user.name ?? user.email ?? `User ${user.id}`}</td>
                      <td>{user.user_type ?? user.role ?? 'user'}</td>
                      <td>{user.office_id ?? '—'}</td>
                      <td>
                        <span className={`app-status ${user.status}`}>{user.status}</span>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </>
            )}
          </PageSection>
        </div>

        <PageSection title="Selected user">
          {!selectedUser ? (
            <EmptyState
              title="No user selected"
              message="Select a user from the list to inspect details or update access."
            />
          ) : (
            <div className="app-grid-two">
              <form className="app-card app-inline-form" onSubmit={handleUpdateUser}>
                <Field label="Display name">
                  <input disabled value={selectedUser.display_name ?? selectedUser.name ?? ''} />
                </Field>
                <Field label="Email">
                  <input disabled value={selectedUser.email ?? ''} />
                </Field>
                <Field label="Status">
                  <select
                    onChange={(event) => setEditedStatus(event.target.value)}
                    value={editedStatus || selectedUser.status}
                  >
                    <option value="active">Active</option>
                    <option value="pending_verification">Pending verification</option>
                    <option value="suspended">Suspended</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </Field>
                <Button>Save status</Button>
              </form>

              {selectedUser.user_type === 'employee' ? (
                <form className="app-card app-inline-form" onSubmit={handleResetPin}>
                  <Field label="Reset PIN">
                    <input
                      onChange={(event) => setNewPin(event.target.value)}
                      type="password"
                      value={newPin}
                    />
                  </Field>
                  <Button disabled={!newPin.trim()}>Reset employee PIN</Button>
                </form>
              ) : (
                <div className="app-card app-stack">
                  <h3>Admin access</h3>
                  <p className="muted">
                    Branch admin office assignments are managed from the office detail screen.
                  </p>
                </div>
              )}
            </div>
          )}
        </PageSection>
      </div>
    </AdminLayout>
  );
}
