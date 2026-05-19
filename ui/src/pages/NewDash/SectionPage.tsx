import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { NewPrimaryLayout } from '../../layouts/NewPrimary';
import { loadHrSession } from '../../services/hrSession';
import { getCurrentActor } from '../../services/worknestApi';
import './style.scss';

type NewDashSectionPageProps = {
  titleKey: string;
  descriptionKey: string;
};

export function NewDashSectionPage({
  titleKey,
  descriptionKey,
}: NewDashSectionPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = loadHrSession();

  usePageTitle(t(titleKey));

  const actorQuery = useQuery({
    queryKey: ['section-page-actor', session?.tenantId],
    queryFn: () => getCurrentActor(session!),
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (!session || actorQuery.isLoading || actorQuery.error) {
      return;
    }

    if (actorQuery.data?.actor.user_type === 'site_owner') {
      const firstOfficeId = actorQuery.data.actor.office_ids[0];
      if (firstOfficeId) {
        navigate(`/new-dash/branches/${firstOfficeId}`, { replace: true });
      }
    }
  }, [actorQuery.data?.actor.office_ids, actorQuery.data?.actor.user_type, actorQuery.error, actorQuery.isLoading, navigate, session]);

  return (
    <NewPrimaryLayout>
      <section className="new-dash-page">
        <p className="eyebrow">{t('pages.newDash.eyebrow')}</p>
        <h1>{t(titleKey)}</h1>
        <p className="new-dash-page-copy">{t(descriptionKey)}</p>
      </section>
    </NewPrimaryLayout>
  );
}
