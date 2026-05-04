import type { ReactNode } from 'react';
import './style.scss';

type DataTableProps = {
  columns: string[];
  children: ReactNode;
  caption?: string;
};

export function DataTable({ columns, children, caption }: DataTableProps) {
  return (
    <div className="data-table-shell">
      <table className="data-table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
