import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearHrSession } from '../../../services/hrSession';
import { useTenantStore } from '../../../stores/tenantStore';
import './style.scss';

export function Header() {
  const tenant = useTenantStore((state) => state.tenant);
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname.startsWith('/dashboard');
  const navItems = isDashboard
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
        {isDashboard ? (
          <button className="header-logout" onClick={handleLogout} type="button">
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
