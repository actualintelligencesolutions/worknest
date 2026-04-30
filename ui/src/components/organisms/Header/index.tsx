import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  clearHrSession,
  HR_SESSION_CHANGE_EVENT,
  loadHrSession,
} from '../../../services/hrSession';
import { useTenantStore } from '../../../stores/tenantStore';
import './style.scss';

export function Header() {
  const tenant = useTenantStore((state) => state.tenant);
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
  const navItems = shouldShowDashboardState
    ? [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Main Office', path: '/dashboard/main-office' },
        { label: 'New Branch', path: '/dashboard/branches/new' },
      ]
    : [
        { label: 'Home', href: isPublicHome ? '#top' : '/#top' },
        { label: 'Features', href: isPublicHome ? '#features' : '/#features' },
        { label: 'Pricing', href: isPublicHome ? '#pricing' : '/#pricing' },
        { label: 'Contact', href: isPublicHome ? '#contact' : '/#contact' },
      ];

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
        isPublic
          ? 'header header-public header-public-compact'
          : 'header'
      }
    >
      <div
        className={
          isPublic
            ? 'header-shell header-shell-public header-shell-public-compact'
            : 'header-shell'
        }
      >
        {isPublic ? (
          <>
            <div className="header-brand-row">
              <div className="header-brand header-brand-public" aria-label={tenant.branding.appName}>
                <img
                  className="header-brand-logo"
                  src="/images/new-logo.jpeg"
                  alt={tenant.branding.appName}
                />
              </div>
              <button
                aria-controls="public-navigation"
                aria-expanded={isMenuOpen}
                className="header-menu-toggle"
                onClick={() => setIsMenuOpen((current) => !current)}
                type="button"
              >
                <span />
                <span />
                <span />
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
              <nav className="header-nav header-nav-public" aria-label="Primary navigation">
                {navItems.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>
              <div className="header-public-actions">
                <Link
                  className="header-login"
                  target="_blank"
                  rel="noreferrer"
                  to="/login"
                >
                  Login
                </Link>
                <Link
                  className="header-signup"
                  target="_blank"
                  rel="noreferrer"
                  to="/register"
                >
                  Register
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="header-brand" aria-label={tenant.branding.appName}>
              <img
                className="header-brand-logo"
                src="/images/new-logo.jpeg"
                alt={tenant.branding.appName}
              />
            </div>

            <nav className="header-nav" aria-label="Primary navigation">
              {navItems.map((item) => (
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
