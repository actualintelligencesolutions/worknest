import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  newHeaderActionKeys,
  newHeaderBrandKey,
  newHeaderNavItems,
  newHeaderProfileItems,
  type NewHeaderNavItem,
} from '../../../config/newHeader';
import './style.scss';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 4a6.5 6.5 0 1 0 4.11 11.56l4.91 4.91 1.41-1.41-4.91-4.91A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a5 5 0 0 0-5 5v2.27c0 .7-.24 1.38-.67 1.92L4.6 13.24A1 1 0 0 0 5.38 15h13.24a1 1 0 0 0 .78-1.76l-1.73-2.05A3.02 3.02 0 0 1 17 9.27V7a5 5 0 0 0-5-5Zm0 20a3 3 0 0 0 2.82-2H9.18A3 3 0 0 0 12 22Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16v2H4V7Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
    </svg>
  );
}

type NewHeaderProps = {
  navItems?: NewHeaderNavItem[];
};

export function NewHeader({ navItems = newHeaderNavItems }: NewHeaderProps) {
  const { t } = useTranslation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function closeMenus() {
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(false);
  }

  return (
    <header className="new-header">
      <div className="new-header-shell">
        <NavLink className="new-header-brand" onClick={closeMenus} to="/new-dash">
          {t(newHeaderBrandKey)}
        </NavLink>

        <nav
          aria-label={t(newHeaderActionKeys.navigationLabel)}
          className="new-header-nav"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              className={({ isActive }) =>
                isActive ? 'new-header-link active' : 'new-header-link'
              }
              end={item.path === '/new-dash' || item.path === '/new-dash/setup'}
              onClick={closeMenus}
              to={item.path}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="new-header-actions">
          <button
            aria-label={t(newHeaderActionKeys.searchLabel)}
            className="new-header-icon-button"
            type="button"
          >
            <SearchIcon />
          </button>

          <button
            aria-label={t(newHeaderActionKeys.notificationsLabel)}
            className="new-header-icon-button"
            type="button"
          >
            <BellIcon />
          </button>

          <div className="new-header-profile" ref={profileMenuRef}>
            <button
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="menu"
              aria-label={t(newHeaderActionKeys.profileLabel)}
              className="new-header-profile-button"
              onClick={() => setIsProfileMenuOpen((current) => !current)}
              type="button"
            >
              <span aria-hidden="true">W</span>
            </button>

            {isProfileMenuOpen ? (
              <div className="new-header-profile-menu" role="menu">
                {newHeaderProfileItems.map((item) => (
                  <NavLink
                    key={item.id}
                    className="new-header-profile-link"
                    onClick={closeMenus}
                    role="menuitem"
                    to={item.path}
                  >
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>

          <button
            aria-expanded={isMobileMenuOpen}
            aria-label={t(
              isMobileMenuOpen
                ? newHeaderActionKeys.closeMenuLabel
                : newHeaderActionKeys.mobileMenuLabel,
            )}
            className="new-header-menu-toggle"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            type="button"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      <div
        className={
          isMobileMenuOpen
            ? 'new-header-mobile-panel new-header-mobile-panel-open'
            : 'new-header-mobile-panel'
        }
      >
        <nav
          aria-label={t(newHeaderActionKeys.navigationLabel)}
          className="new-header-mobile-nav"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              className={({ isActive }) =>
                isActive
                  ? 'new-header-mobile-link active'
                  : 'new-header-mobile-link'
              }
              end={item.path === '/new-dash' || item.path === '/new-dash/setup'}
              onClick={closeMenus}
              to={item.path}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
