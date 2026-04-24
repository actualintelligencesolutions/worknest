import { useTranslation } from 'react-i18next';
import './style.scss';

export function Header() {
  const { t } = useTranslation();
  const navItems = [
    t('header.navigation.service'),
    t('header.navigation.portfolio'),
    t('header.navigation.pricing'),
    t('header.navigation.contact'),
  ];

  return (
    <header className="header">
      <a className="header-brand" href="/">
        <span className="header-brand-mark" aria-hidden="true">
          W
        </span>
        <span>{t('brand.default.name')}</span>
      </a>

      <nav className="header-nav" aria-label={t('header.navigation.label')}>
        {navItems.map((item) => (
          <a key={item} href="/">
            {item}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <a className="header-signup" href="/">
          {t('header.signUp')}
        </a>
        <button className="header-notifications" type="button" aria-label={t('header.notifications')}>
          <span className="header-bell" aria-hidden="true" />
          <span className="header-badge">{t('header.notificationCount')}</span>
        </button>
      </div>
    </header>
  );
}
