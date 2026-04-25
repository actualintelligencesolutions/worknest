import { NavLink } from 'react-router-dom';
import { useTenantStore } from '../../../stores/tenantStore';
import './style.scss';

export function Header() {
  const tenant = useTenantStore((state) => state.tenant);
  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Login', path: '/login' },
    { label: 'Register', path: '/register' },
    { label: 'Workspace', path: '/workspace' },
  ];

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
        <NavLink className="header-login" to="/login">
          Login
        </NavLink>
        <NavLink className="header-signup" to="/register">
          Register Now
        </NavLink>
      </div>
    </header>
  );
}
