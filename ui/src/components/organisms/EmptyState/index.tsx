import type { ReactNode } from 'react';
import './style.scss';

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{message}</p>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
