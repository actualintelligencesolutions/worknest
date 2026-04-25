import type { ReactNode } from 'react';
import './style.scss';

type FieldProps = {
  label: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, error, children }: FieldProps) {
  return (
    <label className={error ? 'field field-error' : 'field'}>
      <span>{label}</span>
      {children}
      {error ? <small>{error}</small> : null}
    </label>
  );
}
