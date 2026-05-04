import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  clearHrSession,
  HR_SESSION_CHANGE_EVENT,
  loadHrSession,
} from '../../../services/hrSession';
import './style.scss';

const navItems = [
  { label: 'Overview', to: '/app' },
  { label: 'Offices', to: '/app/offices' },
  { label: 'Users', to: '/app/users' },
  { label: 'Payroll', to: '/app/payroll' },
  { label: 'Settings', to: '/app/settings' },
];

export function AdminSidebar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState(loadHrSession()?.userName ?? 'Admin');

  useEffect(() => {
    function syncSession() {
      setUserName(loadHrSession()?.userName ?? 'Admin');
    }

    window.addEventListener(HR_SESSION_CHANGE_EVENT, syncSession);
    window.addEventListener('storage', syncSession);

    return () => {
      window.removeEventListener(HR_SESSION_CHANGE_EVENT, syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  function handleLogout() {
    clearHrSession();
    navigate('/login');
  }

  return (
    <>
      <button
        className="admin-sidebar-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        Menu
      </button>
      <aside className={isOpen ? 'admin-sidebar admin-sidebar-open' : 'admin-sidebar'}>
        <div className="admin-sidebar-brand">
          <strong>WORKNEST</strong>
          <span>{userName}</span>
        </div>
        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                isActive ? 'admin-sidebar-link active' : 'admin-sidebar-link'
              }
              key={item.to}
              onClick={() => setIsOpen(false)}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-sidebar-logout" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
