import { useEffect, useState } from 'react';
import './style.scss';

const navItems = [
  { href: '/#features', label: 'Features' },
  { href: '/#workflow', label: 'Workflow' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#contact', label: 'Contact' },
  { href: '/login', label: 'Login' },
];

export function MarketingHeader() {
  const [isOpaque, setIsOpaque] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsOpaque(window.scrollY > 100);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header
      className={
        isOpaque ? 'marketing-header marketing-header-opaque' : 'marketing-header'
      }
    >
      <div className="marketing-header-shell">
        <a className="marketing-header-brand" href="/">
          Worknest
        </a>

        <nav aria-label="Marketing navigation" className="marketing-header-nav">
          {navItems.map((item) => (
            <a className="marketing-header-link" href={item.href} key={item.label}>
              {item.label}
            </a>
          ))}
        </nav>

        <a className="marketing-header-cta" href="/register">
          <span>Register Now</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </header>
  );
}
