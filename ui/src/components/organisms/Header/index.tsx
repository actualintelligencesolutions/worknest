import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  clearHrSession,
  HR_SESSION_CHANGE_EVENT,
  loadHrSession,
} from '../../../services/hrSession';
import './style.scss';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 4a6.5 6.5 0 1 0 4.11 11.56l4.91 4.91 1.41-1.41-4.91-4.91A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5H4V3H2v2h2.18l2.12 10.59A2 2 0 0 0 8.28 17H18v-2H8.28l-.4-2H18a2 2 0 0 0 1.96-1.58l1.46-6.42H7Zm2.6 8-.78-4H19l-.91 4H9.6ZM9.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16v2H4V7Zm0 8h16v2H4v-2Zm0-4h16v2H4v-2Z" />
    </svg>
  );
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [hasHrSession, setHasHrSession] = useState(
    () => loadHrSession() !== null,
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const shouldShowDashboardState =
    hasHrSession || location.pathname.startsWith('/dashboard');
  const isPublic = !shouldShowDashboardState;
  const isPublicHome = isPublic && location.pathname === '/';
  const publicUtilityItems = [
    { label: 'How to use', href: '/#features' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'Contact', href: '/#contact' },
  ];
  const publicNavItems = [
    { label: 'Home', href: isPublicHome ? '#top' : '/#top' },
    { label: 'Features', href: isPublicHome ? '#features' : '/#features' },
    { label: 'Pricing', href: isPublicHome ? '#pricing' : '/#pricing' },
    { label: 'Contact', href: isPublicHome ? '#contact' : '/#contact' },
  ];
  const dashboardNavItems = shouldShowDashboardState
    ? [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Main Office', path: '/dashboard/main-office' },
        { label: 'New Branch', path: '/dashboard/branches/new' },
      ]
    : [];

  useEffect(() => {
    function syncSessionState() {
      setHasHrSession(loadHrSession() !== null);
    }

    window.addEventListener(HR_SESSION_CHANGE_EVENT, syncSessionState);
    window.addEventListener('storage', syncSessionState);

    return () => {
      window.removeEventListener(HR_SESSION_CHANGE_EVENT, syncSessionState);
      window.removeEventListener('storage', syncSessionState);
    };
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, location.hash]);

  function handleLogout() {
    clearHrSession();
    navigate('/login');
  }

  return (
    <header
      className={
        isPublic ? 'header header-public' : 'header header-dashboard'
      }
    >
      <div
        className={
          isPublic
            ? 'header-shell header-shell-public'
            : 'header-shell header-shell-dashboard'
        }
      >
        {isPublic ? (
          <>
            <div className="header-topbar">
              <nav className="header-utility-nav">
                {publicUtilityItems.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>

              <div className="header-utility-actions">
                <a className="header-icon-link" href="/#features" aria-label="Search">
                  <SearchIcon />
                </a>
                <Link className="header-icon-link" to="/login" aria-label="Login">
                  <UserIcon />
                </Link>
                <Link className="header-icon-link" to="/register" aria-label="Register">
                  <CartIcon />
                </Link>
              </div>
            </div>

            <div className="header-mainrow">
              <div className="header-brand">
                <span className="header-brand-mark">WORKNEST</span>
              </div>

              <nav
                className="header-nav header-nav-public header-nav-inline"
                aria-label="Primary navigation"
              >
                {publicNavItems.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>

              <button
                aria-controls="public-navigation"
                aria-expanded={isMenuOpen}
                className="header-menu-toggle"
                onClick={() => setIsMenuOpen((current) => !current)}
                type="button"
              >
                <MenuIcon />
              </button>
            </div>

            <div
              className={
                isMenuOpen
                  ? 'header-menu-panel header-menu-panel-open'
                  : 'header-menu-panel'
              }
              id="public-navigation"
            >
              <nav className="header-nav header-nav-public header-nav-mobile" aria-label="Primary navigation">
                {publicNavItems.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </>
        ) : (
          <>
            <div className="header-brand">
              <span className="header-brand-mark">WORKNEST</span>
            </div>

            <nav className="header-nav" aria-label="Primary navigation">
              {dashboardNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="header-actions">
              <button
                className="header-logout"
                onClick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
