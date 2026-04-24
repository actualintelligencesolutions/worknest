import { NavLink } from 'react-router-dom';
import './style.scss';

type AppHeaderProps = {
  title: string;
  subtitle: string;
  navigation: Array<{
    label: string;
    path: string;
  }>;
};

export function AppHeader({ title, subtitle, navigation }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <p className="eyebrow">{title}</p>
        <h1>{subtitle}</h1>
      </div>
      <nav className="app-nav" aria-label={title}>
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
