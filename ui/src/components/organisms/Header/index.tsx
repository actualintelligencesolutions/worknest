import { NavLink } from 'react-router-dom';
import { useTenantStore } from '../../../stores/tenantStore';
import './style.scss';

export function Header() {
  const tenant = useTenantStore((state) => state.tenant);
  const navItems = [
    { label: 'Home', path: '/' },
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
        <NavLink className="header-signup" to="/register">
          Create company
        </NavLink>
      </div>
    </header>
  );
}
