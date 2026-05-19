import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MarketingLayout } from '../../layouts/MarketingLayout';
import { saveHrSession } from '../../services/hrSession';
import { acceptSiteOwnerInvite, getSiteOwnerInviteAcceptance } from '../../services/worknestApi';
import '../Login/style.scss';

export function SiteOwnerInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const inviteQuery = useQuery({
    queryKey: ['site-owner-invite', token],
    queryFn: () => getSiteOwnerInviteAcceptance(token),
    enabled: token !== '',
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (token === '') {
        throw new Error('Invite token is missing.');
      }

      return acceptSiteOwnerInvite({
        token,
        name: name.trim(),
        password,
      });
    },
    onSuccess: (result) => {
      saveHrSession({
        token: result.session.token,
        tenantId: result.tenant.tenant_id,
        userName: result.user.name,
        userType: result.user.role,
      });
      navigate(`/new-dash/branches/${inviteQuery.data?.invite.office_id ?? ''}`, { replace: true });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to accept invite.');
    },
  });

  const invite = inviteQuery.data?.invite ?? null;

  return (
    <MarketingLayout>
      <section className="marketing-login">
        <div className="marketing-login-shell">
          <div className="marketing-login-line marketing-login-line-left" />
          <div className="marketing-login-line marketing-login-line-right" />

          <div className="marketing-login-card">
            <p className="marketing-login-kicker">Branch access invitation</p>
            <h1>Activate your site owner access</h1>
            <p className="marketing-login-card-copy">
              {invite
                ? `You were invited to manage ${invite.office_name ?? 'this branch'} in ${invite.tenant_name ?? invite.tenant_id}.`
                : 'We are resolving your branch access invitation.'}
            </p>

            {inviteQuery.isLoading ? (
              <p className="marketing-login-card-copy">Loading your invitation…</p>
            ) : invite ? (
              <form
                className="marketing-login-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(null);
                  if (name.trim() === '' || password.trim().length < 8) {
                    setError('Name and an 8 character password are required.');
                    return;
                  }
                  void acceptMutation.mutateAsync();
                }}
              >
                <label>
                  <span>Invited email</span>
                  <input readOnly type="email" value={invite.invited_email} />
                </label>

                <label>
                  <span>Your name</span>
                  <input
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your full name"
                    type="text"
                    value={name}
                  />
                </label>

                <label>
                  <span>Create password</span>
                  <input
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    type="password"
                    value={password}
                  />
                </label>

                {error ? <p className="marketing-login-error">{error}</p> : null}

                <button className="marketing-login-submit" disabled={acceptMutation.isPending} type="submit">
                  {acceptMutation.isPending ? 'Activating access...' : 'Create account and continue'}
                </button>
              </form>
            ) : (
              <p className="marketing-login-error">
                {inviteQuery.error instanceof Error ? inviteQuery.error.message : 'This invitation is not available anymore.'}
              </p>
            )}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
