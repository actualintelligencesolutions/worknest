import { useTranslation } from 'react-i18next';
import './style.scss';

type AboutSectionsProps = {
  components: string[];
};

export function AboutSections({ components }: AboutSectionsProps) {
  const { t } = useTranslation();

  return (
    <div className="content-stack">
      {components.includes('story') ? (
        <section className="text-section">
          <h3>{t('pages.about.storyTitle')}</h3>
          <p>{t('pages.about.storyBody')}</p>
        </section>
      ) : null}

      {components.includes('values') ? (
        <section className="feature-grid compact">
          {['one', 'two', 'three'].map((key) => (
            <article key={key}>
              <h3>{t(`pages.about.values.${key}.title`)}</h3>
              <p>{t(`pages.about.values.${key}.description`)}</p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
