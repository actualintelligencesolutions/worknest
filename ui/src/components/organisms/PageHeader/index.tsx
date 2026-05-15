import type { ReactNode } from 'react';
import './style.scss';

type PageHeaderProps = {
  title: string;
  toolbar?: ReactNode;
};

export function PageHeader({ title, toolbar }: PageHeaderProps) {
  return (
    <section className="page-header" aria-label={title}>
      <div className="page-header-title-row">
        <h1>{title}</h1>
      </div>
      {toolbar ? <div className="page-header-toolbar-row">{toolbar}</div> : null}
    </section>
  );
}
