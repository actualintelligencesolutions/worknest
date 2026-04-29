import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppLayout } from '../../layouts/AppLayout';
import { loadHrSession } from '../../services/hrSession';
import {
  createPayrollPeriod,
  getBranch,
  listPlans,
  uploadPayrollImport,
  type BranchDetail,
  type AuthSession,
  type Plan,
} from '../../services/worknestApi';
import { useTenantStore } from '../../stores/tenantStore';
import './location-setup.scss';

type BranchStatus = 'pending_setup' | 'active' | 'suspended' | 'inactive' | string;

type BranchEditFormState = {
  name: string;
  planId: string;
  status: BranchStatus;
  adminName: string;
  adminEmail: string;
};

type StatusTone = 'yellow' | 'green' | 'red' | 'slate';

type PlanOption = {
  id: number;
  name: string;
  plan_code: string;
  price_cents: number | null;
  currency: string | null;
};

function normalizeStatus(status?: string | null): BranchStatus {
  return status?.trim().toLowerCase() || 'inactive';
}

function statusLabel(status?: string | null): string {
  switch (normalizeStatus(status)) {
    case 'active':
      return 'Active';
    case 'pending_setup':
      return 'Pending Setup';
    case 'suspended':
      return 'Suspended';
    case 'inactive':
      return 'Inactive';
    case 'trial':
      return 'Trial';
    case 'expired':
      return 'Expired';
    default:
      return status?.replace(/_/g, ' ') ?? 'Unknown';
  }
}

function statusTone(status?: string | null): StatusTone {
  switch (normalizeStatus(status)) {
    case 'active':
      return 'green';
    case 'pending_setup':
    case 'trial':
      return 'yellow';
    case 'suspended':
    case 'expired':
      return 'red';
    default:
      return 'slate';
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—';

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', {
        dateStyle: 'medium',
      });
}

function formatPlanSummary(plan: BranchDetail['plan']): string {
  if (!plan.name) {
    return 'No plan assigned';
  }

  if (plan.price_cents !== null && plan.currency) {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: plan.currency,
      maximumFractionDigits: 0,
    }).format(plan.price_cents / 100);

    return `${plan.name} · ${amount}`;
  }

  return plan.name;
}

function createEmptyPlan(): BranchDetail['plan'] {
  return {
    id: null,
    plan_code: null,
    name: null,
    price_cents: null,
    currency: null,
  };
}

function mergePlanOptions(branchPlan: BranchDetail['plan'], plans: Plan[]) {
  const merged: PlanOption[] = [];
  const seen = new Set<number>();

  if (branchPlan.id !== null && branchPlan.name) {
    merged.push({
      id: branchPlan.id,
      name: branchPlan.name,
      plan_code: branchPlan.plan_code ?? '',
      price_cents: branchPlan.price_cents,
      currency: branchPlan.currency,
    });
    seen.add(branchPlan.id);
  }

  plans.forEach((plan) => {
    if (seen.has(plan.id)) {
      return;
    }

    merged.push(plan);
    seen.add(plan.id);
  });

  return merged;
}

function toPlanSummary(plan: {
  name: string;
  price_cents: number | null;
  currency: string | null;
}) {
  if (!plan.name) {
    return 'No plan assigned';
  }

  if (plan.price_cents !== null && plan.currency) {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: plan.currency,
      maximumFractionDigits: 0,
    }).format(plan.price_cents / 100);

    return `${plan.name} · ${amount}`;
  }

  return plan.name;
}

function toPlanState(planId: string, options: PlanOption[]) {
  const selected = options.find((plan) => String(plan.id) === planId);

  return selected
    ? {
        id: selected.id,
        plan_code: selected.plan_code,
        name: selected.name,
        price_cents: selected.price_cents,
        currency: selected.currency,
      }
    : createEmptyPlan();
}

function Icon({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <svg
      aria-hidden="true"
      className="branch-management-icon"
      fill="none"
      height="16"
      viewBox="0 0 20 20"
      width="16"
    >
      {children}
    </svg>
  );
}

function EditIcon() {
  return (
    <Icon>
      <path
        d="M4.5 13.9V16h2.1l7.2-7.2-2.1-2.1-7.2 7.2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m11.7 4.7 1.1-1.1a1.2 1.2 0 0 1 1.7 0l1.9 1.9a1.2 1.2 0 0 1 0 1.7l-1.1 1.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

function PlusIcon() {
  return (
    <Icon>
      <path
        d="M10 4.5v11M4.5 10h11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Icon>
  );
}

function TagIcon() {
  return (
    <Icon>
      <path
        d="M4.5 7.5V4.8h2.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-2 2a1.4 1.4 0 0 1-2 0l-8.3-8.3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M7 7.1a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Z"
        fill="currentColor"
      />
    </Icon>
  );
}

function SaveIcon() {
  return (
    <Icon>
      <path
        d="M5 4.5h8l2.5 2.5v8.5H5z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M7.5 4.5v4h5v-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

function XIcon() {
  return (
    <Icon>
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Icon>
  );
}

function UserIcon() {
  return (
    <Icon>
      <path
        d="M10 10.2a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M4.8 16.5a5.4 5.4 0 0 1 10.4 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

function CheckIcon() {
  return (
    <Icon>
      <path
        d="m4.8 10.2 3.1 3.1 7.3-7.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Icon>
  );
}

function CalendarIcon() {
  return (
    <Icon>
      <path
        d="M5.5 4.8h9a1 1 0 0 1 1 1v8.7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V5.8a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M7 3.5v2M13 3.5v2M4.5 7.8h11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

function BadgeIcon() {
  return (
    <span
      className="branch-management-status-dot"
      aria-hidden="true"
    />
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const tone = statusTone(status);
  const label = statusLabel(status);

  return (
    <span className={`branch-management-status branch-management-status--${tone}`}>
      <BadgeIcon />
      {label}
    </span>
  );
}

function MetaPill({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="branch-management-meta-pill">
      {icon}
      <span>{children}</span>
    </span>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="branch-management-card">
      <div className="branch-management-card-header">
        <div>
          <p className="branch-management-card-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="branch-management-card-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

const MONTH_OPTIONS = [
  { value: 1, label: 'Jan', fullLabel: 'January' },
  { value: 2, label: 'Feb', fullLabel: 'February' },
  { value: 3, label: 'Mar', fullLabel: 'March' },
  { value: 4, label: 'Apr', fullLabel: 'April' },
  { value: 5, label: 'May', fullLabel: 'May' },
  { value: 6, label: 'Jun', fullLabel: 'June' },
  { value: 7, label: 'Jul', fullLabel: 'July' },
  { value: 8, label: 'Aug', fullLabel: 'August' },
  { value: 9, label: 'Sep', fullLabel: 'September' },
  { value: 10, label: 'Oct', fullLabel: 'October' },
  { value: 11, label: 'Nov', fullLabel: 'November' },
  { value: 12, label: 'Dec', fullLabel: 'December' },
];

function formatDetectedPayrollPeriod(month: number, year: number) {
  return `${MONTH_OPTIONS[month - 1]?.fullLabel ?? 'Unknown'} ${year}`;
}

function detectPayrollPeriodFromFile(file: File) {
  const normalized = file.name.toLowerCase();
  const monthIndex = MONTH_OPTIONS.findIndex((month) =>
    normalized.includes(month.fullLabel.toLowerCase()) ||
    normalized.includes(month.label.toLowerCase()),
  );
  const yearMatch = normalized.match(/\b(20\d{2})\b/);

  if (monthIndex === -1 || !yearMatch) {
    return null;
  }

  return {
    month: monthIndex + 1,
    year: Number.parseInt(yearMatch[1], 10),
  };
}

function downloadPayrollTemplate() {
  const template = [
    [
      'employee_code',
      'employee_name',
      'phone',
      'basic',
      'hra',
      'allowances',
      'gross_pay',
      'pf',
      'esi',
      'professional_tax',
      'tds',
      'total_deductions',
      'net_pay',
    ].join(','),
  ].join('\n');

  const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'worknest-payroll-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function PayrollUploadWorkflow({
  session,
  onUploaded,
  actionLabel,
}: {
  session: AuthSession | null;
  onUploaded: (record: PayrollPeriodRecord) => void;
  actionLabel: string;
}) {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);
  const [file, setFile] = useState<File | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [detectedMessage, setDetectedMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const revealPeriod = file !== null;
  const canProcess =
    Boolean(session) &&
    file !== null &&
    selectedMonth !== '' &&
    selectedYear !== '';

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setNotice(null);
    setFile(nextFile);

    if (!nextFile) {
      setDetectedMessage(null);
      setSelectedMonth('');
      setSelectedYear('');
      return;
    }

    const detected = detectPayrollPeriodFromFile(nextFile);
    if (detected) {
      setSelectedMonth(String(detected.month));
      setSelectedYear(String(detected.year));
      setDetectedMessage(
        `Detected: ${formatDetectedPayrollPeriod(detected.month, detected.year)} (Edit if needed)`,
      );
    } else {
      setDetectedMessage(null);
      setSelectedMonth('');
      setSelectedYear('');
    }
  }

  async function handleProcessPayroll() {
    if (!session) {
      setNotice('Please sign in again before processing payroll.');
      return;
    }

    if (!file || !selectedMonth || !selectedYear) {
      setNotice('Choose a payroll sheet, month, and year first.');
      return;
    }

    try {
      setIsProcessing(true);
      setNotice(null);
      const period = await createPayrollPeriod(session, {
        period_month: Number(selectedMonth),
        period_year: Number(selectedYear),
      });
      const importResult = await uploadPayrollImport(session, period.period.id, file);
      onUploaded({
        id: period.period.id,
        importId: importResult.import.id,
        importStatus: importResult.import.status,
        fileName: file.name,
        periodMonth: Number(selectedMonth),
        periodYear: Number(selectedYear),
        status: period.period.status,
        uploadedAt: new Date().toISOString(),
      });
      setNotice('Payroll sheet uploaded and ready for processing.');
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="branch-management-payroll-workflow">
      <div className="branch-management-payroll-hint-row">
        <button
          className="branch-management-template-link"
          onClick={downloadPayrollTemplate}
          type="button"
        >
          Download Template
        </button>
        <span>Supports CSV. Use our template for best results.</span>
      </div>

      <button
        className="button button-primary branch-management-action-button branch-management-action-button--loud"
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        <CheckIcon />
        {file ? 'Change File' : 'Upload Payroll Sheet'}
      </button>

      <input
        accept=".csv"
        aria-label="Upload payroll sheet"
        className="branch-management-file-input"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />

      {file ? (
        <div className="branch-management-file-preview branch-management-file-preview--success">
          <div>
            <strong>{file.name}</strong>
            <span>{Math.max(1, Math.round(file.size / 1024))} KB uploaded</span>
          </div>
          <span className="branch-management-file-status">Ready</span>
          <button
            className="branch-management-file-change"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Change file
          </button>
        </div>
      ) : (
        <div className="branch-management-file-empty">
          <p>No file selected yet.</p>
          <span>Choose a payroll sheet to reveal the period controls.</span>
        </div>
      )}

      {revealPeriod ? (
        <div className="branch-management-payroll-period">
          <div className="branch-management-payroll-period-heading">
            <p>Select Payroll Period</p>
            {detectedMessage ? <span>{detectedMessage}</span> : null}
          </div>

          <div className="branch-management-payroll-period-grid">
            <label className="branch-management-field">
              <span>Month</span>
              <select
                onChange={(event) => setSelectedMonth(event.target.value)}
                value={selectedMonth}
              >
                <option value="">Select month</option>
                {MONTH_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="branch-management-field">
              <span>Year</span>
              <select
                onChange={(event) => setSelectedYear(event.target.value)}
                value={selectedYear}
              >
                <option value="">Select year</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            className="button button-primary branch-management-action-button branch-management-action-button--loud"
            disabled={!canProcess || isProcessing}
            onClick={handleProcessPayroll}
            type="button"
          >
            <CheckIcon />
            {isProcessing ? 'Processing…' : actionLabel}
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="branch-management-inline-notice" role="status">
          {notice}
        </div>
      ) : null}
    </div>
  );
}

function PayrollSetupCard({
  session,
  onUploaded,
}: {
  session: AuthSession | null;
  onUploaded: (record: PayrollPeriodRecord) => void;
}) {
  return (
    <SectionCard
      eyebrow="Payroll"
      title="Payroll Setup"
      description="Upload your payroll sheet to activate salary processing."
    >
      <PayrollUploadWorkflow
        actionLabel="Process Payroll"
        onUploaded={onUploaded}
        session={session}
      />
    </SectionCard>
  );
}

function PayrollUploadModal({
  session,
  onClose,
  onUploaded,
}: {
  session: AuthSession | null;
  onClose: () => void;
  onUploaded: (record: PayrollPeriodRecord) => void;
}) {
  return (
    <div className="branch-management-modal-backdrop" role="presentation">
      <div
        aria-modal="true"
        aria-labelledby="payroll-upload-modal-title"
        className="branch-management-modal branch-management-modal--wide"
        role="dialog"
      >
        <div className="branch-management-modal-header">
          <div>
            <p className="branch-management-card-eyebrow">Manage Uploaded Payroll Data</p>
            <h3 id="payroll-upload-modal-title">Upload payroll file</h3>
            <p>
              Add a new payroll file without leaving the management screen.
            </p>
          </div>
          <button
            className="button button-ghost branch-management-modal-close"
            onClick={onClose}
            type="button"
          >
            <XIcon />
            Close
          </button>
        </div>

        <div className="branch-management-modal-body">
          <PayrollUploadWorkflow
            actionLabel="Process Payroll"
            onUploaded={onUploaded}
            session={session}
          />
          <div className="branch-management-modal-footer">
            <button className="button button-ghost" onClick={onClose} type="button">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type PayrollPeriodRecord = {
  id: number;
  importId: number | null;
  importStatus: string | null;
  fileName: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  uploadedAt: string;
};

function payrollRecordsStorageKey(tenantId: string, branchId: number) {
  return `worknest:payroll-records:${tenantId}:${branchId}`;
}

function normalizePayrollRecord(record: Partial<PayrollPeriodRecord>): PayrollPeriodRecord | null {
  if (
    typeof record.id !== 'number' ||
    typeof record.fileName !== 'string' ||
    typeof record.periodMonth !== 'number' ||
    typeof record.periodYear !== 'number' ||
    typeof record.status !== 'string' ||
    typeof record.uploadedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: record.id,
    importId: typeof record.importId === 'number' ? record.importId : null,
    importStatus: typeof record.importStatus === 'string' ? record.importStatus : null,
    fileName: record.fileName,
    periodMonth: record.periodMonth,
    periodYear: record.periodYear,
    status: record.status,
    uploadedAt: record.uploadedAt,
  };
}

function readPayrollRecords(tenantId: string, branchId: number) {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(payrollRecordsStorageKey(tenantId, branchId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Partial<PayrollPeriodRecord>[];
    return parsed
      .map((record) => normalizePayrollRecord(record))
      .filter((record): record is PayrollPeriodRecord => record !== null)
      .sort((first, second) => {
        if (second.periodYear !== first.periodYear) {
          return second.periodYear - first.periodYear;
        }

        return second.periodMonth - first.periodMonth;
      });
  } catch {
    return [];
  }
}

function writePayrollRecords(tenantId: string, branchId: number, records: PayrollPeriodRecord[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    payrollRecordsStorageKey(tenantId, branchId),
    JSON.stringify(records),
  );
}

function PayrollPeriodModal({
  record,
  session,
  onClose,
  onSave,
}: {
  record: PayrollPeriodRecord | null;
  session: AuthSession | null;
  onClose: () => void;
  onSave: (record: PayrollPeriodRecord) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [month, setMonth] = useState(record ? String(record.periodMonth) : '');
  const [year, setYear] = useState(record ? String(record.periodYear) : '');
  const [note, setNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!record) return;

    setSelectedFile(null);
    setMonth(String(record.periodMonth));
    setYear(String(record.periodYear));
    setNote(null);
  }, [record]);

  if (!record) {
    return null;
  }

  async function handleSubmit() {
    if (!month || !year) {
      setNote('Select a month and year first.');
      return;
    }

    if (!session) {
      setNote('Please sign in again before updating payroll data.');
      return;
    }

    const nextFile = selectedFile;
    let nextImportId = record.importId;
    let nextImportStatus = record.importStatus;

    if (nextFile) {
      const importResult = await uploadPayrollImport(session, record.id, nextFile);
      nextImportId = importResult.import.id;
      nextImportStatus = importResult.import.status;
    }

    onSave({
      ...record,
      importId: nextImportId,
      importStatus: nextImportStatus,
      fileName: nextFile?.name ?? record.fileName,
      periodMonth: Number(month),
      periodYear: Number(year),
      uploadedAt: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <div className="branch-management-modal-backdrop" role="presentation">
      <div
        aria-modal="true"
        aria-labelledby="payroll-period-modal-title"
        className="branch-management-modal"
        role="dialog"
      >
        <div className="branch-management-modal-header">
          <div>
            <p className="branch-management-card-eyebrow">Manage Uploaded Payroll Data</p>
            <h3 id="payroll-period-modal-title">
              {MONTH_OPTIONS[record.periodMonth - 1]?.fullLabel ?? 'Payroll'} {record.periodYear}
            </h3>
            <p>
              Edit the payroll period, replace the file, or keep this upload as-is.
            </p>
          </div>
          <button
            className="button button-ghost branch-management-modal-close"
            onClick={onClose}
            type="button"
          >
            <XIcon />
            Close
          </button>
        </div>

        <div className="branch-management-modal-body">
          <div className="branch-management-modal-summary">
            <strong>{record.fileName}</strong>
            <span>Uploaded {formatDate(record.uploadedAt)}</span>
          </div>

          <div className="branch-management-modal-actions">
            <button
              className="button button-secondary"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Change Payroll File
            </button>
            <input
              ref={fileInputRef}
              className="branch-management-file-input"
              accept=".csv"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setSelectedFile(next);
                if (next) {
                  setNote(`Selected ${next.name}`);
                }
              }}
              type="file"
            />
          </div>

          <div className="branch-management-payroll-period-grid">
            <label className="branch-management-field">
              <span>Month</span>
              <select value={month} onChange={(event) => setMonth(event.target.value)}>
                <option value="">Select month</option>
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="branch-management-field">
              <span>Year</span>
              <select value={year} onChange={(event) => setYear(event.target.value)}>
                <option value="">Select year</option>
                {Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - 1 + index).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {note ? (
            <div className="branch-management-inline-notice" role="status">
              {note}
            </div>
          ) : null}

          <div className="branch-management-modal-footer">
            <button className="button button-ghost" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="button button-primary" onClick={() => void handleSubmit()} type="button">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayrollManagementSection({
  records,
  session,
  onAddNew,
  onUpdateRecord,
}: {
  records: PayrollPeriodRecord[];
  session: AuthSession | null;
  onAddNew: () => void;
  onUpdateRecord: (record: PayrollPeriodRecord) => void;
}) {
  const [page, setPage] = useState(1);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const pageRecords = records.slice((page - 1) * pageSize, page * pageSize);
  const selectedRecord =
    selectedRecordId !== null
      ? records.find((record) => record.id === selectedRecordId) ?? null
      : null;

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  return (
    <section className="branch-management-card">
      <div className="branch-management-card-header">
        <div>
          <p className="branch-management-card-eyebrow">Payroll</p>
          <h2>Manage Uploaded Payroll Data</h2>
          <p>
            Review payroll files by period, open a month to edit it, or replace the file.
          </p>
        </div>
        <div className="branch-management-card-action">
          <button
            className="button button-primary branch-management-action-button branch-management-action-button--loud"
            onClick={onAddNew}
            type="button"
          >
            <CheckIcon />
            Upload New Payroll File
          </button>
        </div>
      </div>

      <div className="branch-management-record-list">
        {pageRecords.length === 0 ? (
          <div className="branch-management-file-empty">
            <p>No payroll periods yet.</p>
            <span>Upload the first payroll file to begin managing periods here.</span>
          </div>
        ) : (
          pageRecords.map((record) => (
            <button
              key={record.id}
              className="branch-management-record-row"
              onClick={() => setSelectedRecordId(record.id)}
              type="button"
            >
              <div>
                <strong>{MONTH_OPTIONS[record.periodMonth - 1]?.fullLabel ?? 'Payroll'} {record.periodYear}</strong>
                <span>{record.fileName}</span>
                <span>Uploaded {formatDate(record.uploadedAt)}</span>
              </div>
              <span className="branch-management-file-status">{record.status}</span>
            </button>
          ))
        )}
      </div>

      {records.length > pageSize ? (
        <div className="branch-management-pagination">
          <button
            className="button button-secondary"
            disabled={page === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            className="button button-secondary"
            disabled={page === pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      ) : null}

      <PayrollPeriodModal
        onClose={() => setSelectedRecordId(null)}
        onSave={onUpdateRecord}
        session={session}
        record={selectedRecord}
      />
    </section>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="branch-management-info-row">
      <div className="branch-management-info-label">{label}</div>
      <div className="branch-management-info-value">{children}</div>
    </div>
  );
}

function FormField({
  label,
  helperText,
  children,
}: {
  label: string;
  helperText?: string;
  children: ReactNode;
}) {
  return (
    <label className="branch-management-field">
      <span>{label}</span>
      {children}
      {helperText ? <small>{helperText}</small> : null}
    </label>
  );
}

function BranchEditForm({
  form,
  isSaving,
  isDirty,
  planOptions,
  plansLoading,
  plansError,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: BranchEditFormState;
  isSaving: boolean;
  isDirty: boolean;
  planOptions: PlanOption[];
  plansLoading: boolean;
  plansError: string | null;
  onChange: (next: BranchEditFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="branch-management-edit-card" id="branch-edit-card">
      <div className="branch-management-card-header">
        <div>
          <p className="branch-management-card-eyebrow">Edit Branch</p>
          <h2>Update branch details</h2>
          <p>
            Adjust the branch name, plan, and status from one place.
          </p>
        </div>
      </div>

      <form className="branch-management-form" onSubmit={onSubmit}>
        <div className="branch-management-form-grid">
          <FormField label="Branch Name" helperText="Visible to admins and operators.">
            <input
              onChange={(event) =>
                onChange({ ...form, name: event.target.value })
              }
              type="text"
              value={form.name}
            />
          </FormField>

          <FormField label="Plan" helperText="Select the branch's active plan.">
            <select
              disabled={plansLoading || planOptions.length === 0}
              onChange={(event) =>
                onChange({ ...form, planId: event.target.value })
              }
              value={form.planId}
            >
              <option value="">No plan assigned</option>
              {planOptions.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {toPlanSummary(plan)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Status" helperText="Controls how this branch appears.">
            <select
              onChange={(event) =>
                onChange({
                  ...form,
                  status: event.target.value as BranchStatus,
                })
              }
              value={form.status}
            >
              <option value="pending_setup">Pending Setup</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
              <option value="trial">Trial</option>
              <option value="expired">Expired</option>
            </select>
          </FormField>
        </div>

        <div className="branch-management-form-grid branch-management-form-grid--admin">
          <FormField label="Admin Name" helperText="The person responsible for this branch.">
            <input
              onChange={(event) =>
                onChange({ ...form, adminName: event.target.value })
              }
              type="text"
              value={form.adminName}
            />
          </FormField>

          <FormField label="Admin Email" helperText="Used for branch notifications.">
            <input
              onChange={(event) =>
                onChange({ ...form, adminEmail: event.target.value })
              }
              type="email"
              value={form.adminEmail}
            />
          </FormField>
        </div>

        {plansError ? (
          <div className="branch-management-inline-notice" role="status">
            {plansError}
          </div>
        ) : null}

        <div className="branch-management-form-actions">
          <button
            className="button button-ghost"
            onClick={onCancel}
            type="button"
          >
            <XIcon />
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={isSaving || !isDirty}
            type="submit"
          >
            <SaveIcon />
            Save Changes
          </button>
        </div>
      </form>
    </section>
  );
}

export function ManageBranchPage() {
  const { id } = useParams<{ id: string }>();
  const tenant = useTenantStore((state) => state.tenant);

  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [payrollRecords, setPayrollRecords] = useState<PayrollPeriodRecord[]>(
    [],
  );
  const [isPayrollUploadModalOpen, setIsPayrollUploadModalOpen] =
    useState(false);
  const [form, setForm] = useState<BranchEditFormState>({
    name: '',
    planId: '',
    status: 'pending_setup',
    adminName: '',
    adminEmail: '',
  });

  usePageTitle(branch?.location.name ?? 'Manage Branch');

  useEffect(() => {
    const storedSession = loadHrSession();
    setSession(storedSession);

    if (!storedSession || !id) {
      setIsLoading(false);
      return;
    }

    const branchId = Number.parseInt(id, 10);
    if (Number.isNaN(branchId)) {
      setError('Invalid branch identifier.');
      setIsLoading(false);
      return;
    }

    setPayrollRecords(readPayrollRecords(storedSession.tenantId, branchId));

    let isCurrent = true;

    async function loadBranch() {
      try {
        const response = await getBranch(storedSession, branchId);
        if (!isCurrent) return;

        setBranch(response);
        setForm({
          name: response.location.name ?? '',
          planId: response.plan.id !== null ? String(response.plan.id) : '',
          status: normalizeStatus(response.location.status),
          adminName: response.admin.name ?? '',
          adminEmail: response.admin.email ?? '',
        });
      } catch (err) {
        if (!isCurrent) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadBranch();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  useEffect(() => {
    if (!session || !id) {
      return;
    }

    const branchId = Number.parseInt(id, 10);
    if (Number.isNaN(branchId)) {
      return;
    }

    writePayrollRecords(session.tenantId, branchId, payrollRecords);
  }, [id, payrollRecords, session]);

  useEffect(() => {
    let isCurrent = true;

    async function loadPlanOptions() {
      try {
        setPlansLoading(true);
        const response = await listPlans();
        if (!isCurrent) return;

        setPlans(response.plans);
      } catch (err) {
        if (!isCurrent) return;

        setPlansError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isCurrent) {
          setPlansLoading(false);
        }
      }
    }

    void loadPlanOptions();

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!branch) return;

    setForm({
      name: branch.location.name ?? '',
      planId: branch.plan.id !== null ? String(branch.plan.id) : '',
      status: normalizeStatus(branch.location.status),
      adminName: branch.admin.name ?? '',
      adminEmail: branch.admin.email ?? '',
    });
  }, [branch]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branch) return;

    const availablePlans = mergePlanOptions(branch.plan, plans);
    const selectedPlan = toPlanState(form.planId, availablePlans);

    try {
      setIsSaving(true);
      setBranch({
        ...branch,
        location: {
          ...branch.location,
          name: form.name,
          status: form.status,
        },
        plan: selectedPlan,
        admin: {
          ...branch.admin,
          name: form.adminName || null,
          email: form.adminEmail || null,
        },
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    if (!branch) return;

    setForm({
      name: branch.location.name ?? '',
      planId: branch.plan.id !== null ? String(branch.plan.id) : '',
      status: normalizeStatus(branch.location.status),
      adminName: branch.admin.name ?? '',
      adminEmail: branch.admin.email ?? '',
    });
    setIsEditing(false);
  }

  function handleUploadedPayroll(record: PayrollPeriodRecord) {
    setPayrollRecords((current) => {
      const next = [record, ...current.filter((item) => item.id !== record.id)];
      return next.sort((first, second) => {
        if (second.periodYear !== first.periodYear) {
          return second.periodYear - first.periodYear;
        }

        return second.periodMonth - first.periodMonth;
      });
    });
    setIsPayrollUploadModalOpen(false);
  }

  function handleUpdatedPayroll(record: PayrollPeriodRecord) {
    setPayrollRecords((current) =>
      current.map((item) => (item.id === record.id ? record : item)),
    );
  }

  const branchPlanOptions: PlanOption[] = branch
    ? mergePlanOptions(branch.plan, plans)
    : plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        plan_code: plan.plan_code,
        price_cents: plan.price_cents,
        currency: plan.currency,
      }));
  const branchTitle = branch?.location.name ?? 'Manage Branch';
  const branchPlanSummary = branch ? formatPlanSummary(branch.plan) : 'No plan assigned';
  const activeSince = branch ? formatDate(branch.location.created_at) : '—';
  const status = branch?.location.status ?? null;
  const isDirty =
    branch &&
    (form.name !== (branch.location.name ?? '') ||
      form.planId !== (branch.plan.id !== null ? String(branch.plan.id) : '') ||
      form.status !== normalizeStatus(branch.location.status) ||
      form.adminName !== (branch.admin.name ?? '') ||
      form.adminEmail !== (branch.admin.email ?? ''));
  const hasPayrollRecords = payrollRecords.length > 0;

  return (
    <AppLayout tenant={tenant}>
      <section className="branch-management-page" aria-labelledby="branch-management-title">
        <Link className="branch-management-back-link" to="/dashboard">
          ← Back to Dashboard
        </Link>

        <header className="branch-management-topbar">
          <div className="branch-management-topbar-copy">
            <p className="eyebrow">Branch Management</p>
            <h1 id="branch-management-title">{branchTitle}</h1>
            <p>
              Review branch details, keep the admin information current, and
              expand the workspace when you are ready.
            </p>

            <div className="branch-management-meta" aria-label="Branch metadata">
              <MetaPill icon={<CalendarIcon />}>Active since {activeSince}</MetaPill>
              <MetaPill icon={<TagIcon />}>Plan: {branchPlanSummary}</MetaPill>
              <StatusBadge status={status} />
            </div>
          </div>

          <div className="branch-management-header-actions" aria-label="Branch actions">
            <button
              className="button button-primary branch-management-action-button"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              <EditIcon />
              Edit Branch
            </button>
            <Link
              className="button button-secondary branch-management-action-button"
              to="/dashboard/branches/new"
            >
              <PlusIcon />
              Add New Branch
            </Link>
          </div>
        </header>

        {error ? (
          <div className="location-setup-notice error" role="alert">
            {error}
          </div>
        ) : null}

        {isLoading ? <div className="branch-management-loading">Loading branch…</div> : null}

        {!isLoading && branch ? (
          <div className="branch-management-stack">
            {isEditing ? (
              <BranchEditForm
                form={form}
                isDirty={Boolean(isDirty)}
                isSaving={isSaving}
                onCancel={resetForm}
                onChange={setForm}
                onSubmit={handleSave}
                planOptions={branchPlanOptions}
                plansError={plansError}
                plansLoading={plansLoading}
              />
            ) : null}

            <SectionCard
              eyebrow="Overview"
              title="Branch Snapshot"
              description="The most important branch facts at a glance."
            >
              <dl className="branch-management-info-list">
                <InfoRow label="Branch Name">
                  <strong>{branch.location.name}</strong>
                </InfoRow>
                <InfoRow label="Status">
                  <StatusBadge status={branch.location.status} />
                </InfoRow>
                <InfoRow label="Plan">
                  <div className="branch-management-info-stack">
                    <strong>{branch.plan.name ?? 'No plan assigned'}</strong>
                    <span>{formatPlanSummary(branch.plan)}</span>
                  </div>
                </InfoRow>
                <InfoRow label="Created Date">{formatDate(branch.location.created_at)}</InfoRow>
              </dl>
            </SectionCard>

            <SectionCard
              eyebrow="Administration"
              title="Admin Details"
              description="Keep the local admin contact up to date for branch operations."
              action={
                <button
                  className="button button-secondary branch-management-action-button"
                  onClick={() => setIsEditing(true)}
                  type="button"
                >
                  <UserIcon />
                  Change Admin
                </button>
              }
            >
              <dl className="branch-management-info-list">
                <InfoRow label="Admin Name">
                  <strong>{branch.admin.name ?? '—'}</strong>
                </InfoRow>
                <InfoRow label="Admin Email">
                  <span>{branch.admin.email ?? '—'}</span>
                </InfoRow>
              </dl>
            </SectionCard>

            {!hasPayrollRecords ? (
              <PayrollSetupCard
                onUploaded={handleUploadedPayroll}
                session={session}
              />
            ) : (
              <PayrollManagementSection
                onAddNew={() => setIsPayrollUploadModalOpen(true)}
                onUpdateRecord={handleUpdatedPayroll}
                records={payrollRecords}
                session={session}
              />
            )}
          </div>
        ) : null}

        {isPayrollUploadModalOpen ? (
          <PayrollUploadModal
            onClose={() => setIsPayrollUploadModalOpen(false)}
            onUploaded={handleUploadedPayroll}
            session={session}
          />
        ) : null}
      </section>
    </AppLayout>
  );
}
