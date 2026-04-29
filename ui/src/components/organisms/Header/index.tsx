import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  const shouldShowDashboardState =
    hasHrSession || location.pathname.startsWith('/dashboard');
  const isPublicHome = !shouldShowDashboardState && location.pathname === '/';
  const navItems = shouldShowDashboardState
    ? [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Main Office', path: '/dashboard/main-office' },
        { label: 'New Branch', path: '/dashboard/branches/new' },
      ]
    : isPublicHome
      ? [
          { label: 'Home', href: '#top' },
          { label: 'Features', href: '#features' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'Contact', href: '#contact' },
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

  function handleLogout() {
    clearHrSession();
    navigate('/login');
  }

  return (
    <header className="header">
      <div className="header-brand" aria-label={tenant.branding.appName}>
        <img
          className="header-brand-logo"
          src="/images/worknest-logo.png"
          alt={tenant.branding.appName}
        />
      </div>

      <nav className="header-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          'path' in item ? (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ) : (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          )
        ))}
      </nav>

      <div className="header-actions">
        {shouldShowDashboardState ? (
          <button
            className="header-logout"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
        ) : (
          <>
            <a
              className="header-signup"
              href={isPublicHome ? '#contact' : '/#contact'}
            >
              Enquire
            </a>
          </>
        )}
      </div>
    </header>
  );
}
