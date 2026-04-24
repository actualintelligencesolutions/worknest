import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../atoms/Button';
import './style.scss';

type MarketingSectionsProps = {
  components: string[];
};

export function MarketingSections({ components }: MarketingSectionsProps) {
  const { t } = useTranslation();

  return (
    <div className="marketing-stack">
      {components.includes('hero') ? (
        <section className="hero-section">
          <div>
            <p className="eyebrow">{t('pages.home.eyebrow')}</p>
            <h2>{t('pages.home.heroTitle')}</h2>
            <p>{t('pages.home.heroDescription')}</p>
            <div className="action-row">
              <Button as={Link} to="/contact">
                {t('pages.home.primaryCta')}
              </Button>
              <Button as={Link} to="/about" variant="secondary">
                {t('pages.home.secondaryCta')}
              </Button>
            </div>
          </div>
          <div
            className="metric-panel"
            aria-label={t('pages.home.metricLabel')}
          >
            <strong>{t('pages.home.metricValue')}</strong>
            <span>{t('pages.home.metricLabel')}</span>
          </div>
        </section>
      ) : null}

      {components.includes('features') ? (
        <section className="feature-grid">
          {['one', 'two', 'three'].map((key) => (
            <article key={key}>
              <h3>{t(`pages.home.features.${key}.title`)}</h3>
              <p>{t(`pages.home.features.${key}.description`)}</p>
            </article>
          ))}
        </section>
      ) : null}

      {components.includes('proof') ? (
        <section className="statement-band">
          <p>{t('pages.home.proof')}</p>
        </section>
      ) : null}
    </div>
  );
}
