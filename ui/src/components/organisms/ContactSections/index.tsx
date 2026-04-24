import { useTranslation } from 'react-i18next';
import { Button } from '../../atoms/Button';
import { Field } from '../../atoms/Field';
import './style.scss';

type ContactSectionsProps = {
  components: string[];
};

export function ContactSections({ components }: ContactSectionsProps) {
  const { t } = useTranslation();

  if (!components.includes('contactPanel')) {
    return null;
  }

  return (
    <section className="contact-grid">
      <div className="text-section">
        <h3>{t('pages.contact.panelTitle')}</h3>
        <p>{t('pages.contact.panelBody')}</p>
      </div>
      <form className="panel">
        <Field label={t('pages.contact.nameLabel')}>
          <input placeholder={t('pages.contact.namePlaceholder')} />
        </Field>
        <Field label={t('pages.contact.emailLabel')}>
          <input placeholder={t('pages.contact.emailPlaceholder')} />
        </Field>
        <Field label={t('pages.contact.messageLabel')}>
          <textarea placeholder={t('pages.contact.messagePlaceholder')} />
        </Field>
        <Button type="button">{t('pages.contact.submitLabel')}</Button>
      </form>
    </section>
  );
}
