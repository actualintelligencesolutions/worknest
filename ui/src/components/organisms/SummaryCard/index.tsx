import type { ReactNode } from 'react';
import './style.scss';

type SummaryCardProps = {
  label: string;
  value: ReactNode;
  helper?: string;
};

export function SummaryCard({ label, value, helper }: SummaryCardProps) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <p>{helper}</p> : null}
    </article>
  );
}
