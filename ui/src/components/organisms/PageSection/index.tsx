import type { ReactNode } from 'react';
import './style.scss';

type PageSectionProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageSection({
  title,
  description,
  actions,
  children,
}: PageSectionProps) {
  return (
    <section className="page-section">
      <div className="page-section-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="page-section-actions">{actions}</div> : null}
      </div>
      <div className="page-section-body">{children}</div>
    </section>
  );
}
