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
  const navItems = shouldShowDashboardState
    ? [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Main Office', path: '/dashboard/main-office' },
        { label: 'New Branch', path: '/dashboard/branches/new' },
      ]
    : [
        { label: 'Home', path: '/' },
        { label: 'Login', path: '/login' },
        { label: 'Register', path: '/register' },
        { label: 'Workspace', path: '/workspace' },
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

  function handleLogout() {
    clearHrSession();
    navigate('/login');
  }

  return (
    <header className="header">
      <NavLink className="header-brand" to="/">
        <span className="header-brand-mark" aria-hidden="true">
          W
        </span>
        <span>{tenant.branding.appName}</span>
      </NavLink>

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
            <NavLink className="header-login" to="/login">
              Login
            </NavLink>
            <NavLink className="header-signup" to="/register">
              Register Now
            </NavLink>
          </>
        )}
      </div>
    </header>
  );
}
