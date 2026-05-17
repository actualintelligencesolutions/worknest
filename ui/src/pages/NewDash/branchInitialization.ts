import type {
  CompanyLocation,
  PayrollBatch,
  UserSummary,
} from '../../services/worknestApi';

export type BranchInitializationStatus =
  | 'unassigned'
  | 'assigned_not_started'
  | 'format_uploaded'
  | 'headers_confirmed'
  | 'template_selected'
  | 'initialized'
  | 'blocked';

export type BranchTemplateChoice = {
  key: string;
  name: string;
  description: string;
};

export const branchPayslipTemplates: BranchTemplateChoice[] = [
  {
    key: 'clean_classic',
    name: 'Clean Classic',
    description: 'Traditional salary slip layout with clear totals and compact sections.',
  },
  {
    key: 'mint_modern',
    name: 'Mint Modern',
    description: 'Soft branded payslip with stronger hierarchy for branch-led teams.',
  },
  {
    key: 'statement_grid',
    name: 'Statement Grid',
    description: 'Dense tabular format for operations teams who prefer structured detail.',
  },
];

export type BranchInitializationSettings = {
  payslip_template_key?: string | null;
  payslip_template_name?: string | null;
  branch_initialization_completed_at?: string | null;
  branch_initialization_completed_by_user_id?: number | null;
};

export type BranchInitializationState = {
  branch: CompanyLocation;
  owner: UserSummary | null;
  latestBatch: PayrollBatch | null;
  status: BranchInitializationStatus;
  statusLabelKey: string;
  nextActionLabelKey: string;
  summaryKey: string;
  settings: BranchInitializationSettings;
  hasTemplate: boolean;
  isReadyMarked: boolean;
  hasUploadedFormat: boolean;
  hasConfirmedHeaders: boolean;
  isBlocked: boolean;
  lastActivityAt: string | null;
};

export function parseBranchSettings(
  value: CompanyLocation['settings_json'],
): BranchInitializationSettings {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsedBranchSettings(parsed);
    } catch {
      return {};
    }
  }

  return parsedBranchSettings(value);
}

function parsedBranchSettings(
  value: Record<string, unknown>,
): BranchInitializationSettings {
  return {
    payslip_template_key:
      typeof value.payslip_template_key === 'string'
        ? value.payslip_template_key
        : null,
    payslip_template_name:
      typeof value.payslip_template_name === 'string'
        ? value.payslip_template_name
        : null,
    branch_initialization_completed_at:
      typeof value.branch_initialization_completed_at === 'string'
        ? value.branch_initialization_completed_at
        : null,
    branch_initialization_completed_by_user_id:
      typeof value.branch_initialization_completed_by_user_id === 'number'
        ? value.branch_initialization_completed_by_user_id
        : null,
  };
}

export function computeBranchInitializationState({
  branch,
  owner,
  latestBatch,
}: {
  branch: CompanyLocation;
  owner: UserSummary | null;
  latestBatch: PayrollBatch | null;
}): BranchInitializationState {
  const settings = parseBranchSettings(branch.settings_json);
  const hasTemplate = Boolean(settings.payslip_template_key);
  const isReadyMarked = Boolean(settings.branch_initialization_completed_at);
  const uploadStatus = latestBatch?.upload_status ?? null;
  const errorRows = latestBatch?.validation_summary?.error_rows ?? 0;

  const hasUploadedFormat = Boolean(latestBatch);
  const hasConfirmedHeaders = Boolean(
    latestBatch &&
      (
        uploadStatus === 'mapped' ||
        uploadStatus === 'processed' ||
        uploadStatus === 'confirmed' ||
        uploadStatus === 'published' ||
        (uploadStatus === 'validated' && errorRows === 0)
      ),
  );
  const isBlocked = uploadStatus === 'validated' && errorRows > 0;

  let status: BranchInitializationStatus;
  if (!owner) {
    status = 'unassigned';
  } else if (!latestBatch) {
    status = 'assigned_not_started';
  } else if (isBlocked) {
    status = 'blocked';
  } else if (!hasConfirmedHeaders) {
    status = 'format_uploaded';
  } else if (!hasTemplate) {
    status = 'headers_confirmed';
  } else if (!isReadyMarked) {
    status = 'template_selected';
  } else {
    status = 'initialized';
  }

  const metadata = statusMetadata(status);

  return {
    branch,
    owner,
    latestBatch,
    status,
    statusLabelKey: metadata.statusLabelKey,
    nextActionLabelKey: metadata.nextActionLabelKey,
    summaryKey: metadata.summaryKey,
    settings,
    hasTemplate,
    isReadyMarked,
    hasUploadedFormat,
    hasConfirmedHeaders,
    isBlocked,
    lastActivityAt:
      latestBatch?.updated_at ??
      latestBatch?.created_at ??
      branch.updated_at ??
      branch.created_at ??
      null,
  };
}

function statusMetadata(status: BranchInitializationStatus) {
  switch (status) {
    case 'unassigned':
      return {
        statusLabelKey: 'pages.newDash.branchInitialization.status.unassigned',
        nextActionLabelKey: 'pages.newDash.branchInitialization.actions.assignOwner',
        summaryKey: 'pages.newDash.branchInitialization.summary.unassigned',
      };
    case 'assigned_not_started':
      return {
        statusLabelKey: 'pages.newDash.branchInitialization.status.assignedNotStarted',
        nextActionLabelKey: 'pages.newDash.branchInitialization.actions.uploadFormat',
        summaryKey: 'pages.newDash.branchInitialization.summary.assignedNotStarted',
      };
    case 'format_uploaded':
      return {
        statusLabelKey: 'pages.newDash.branchInitialization.status.formatUploaded',
        nextActionLabelKey: 'pages.newDash.branchInitialization.actions.confirmHeaders',
        summaryKey: 'pages.newDash.branchInitialization.summary.formatUploaded',
      };
    case 'headers_confirmed':
      return {
        statusLabelKey: 'pages.newDash.branchInitialization.status.headersConfirmed',
        nextActionLabelKey: 'pages.newDash.branchInitialization.actions.selectTemplate',
        summaryKey: 'pages.newDash.branchInitialization.summary.headersConfirmed',
      };
    case 'template_selected':
      return {
        statusLabelKey: 'pages.newDash.branchInitialization.status.templateSelected',
        nextActionLabelKey: 'pages.newDash.branchInitialization.actions.markReady',
        summaryKey: 'pages.newDash.branchInitialization.summary.templateSelected',
      };
    case 'initialized':
      return {
        statusLabelKey: 'pages.newDash.branchInitialization.status.initialized',
        nextActionLabelKey: 'pages.newDash.branchInitialization.actions.openBranch',
        summaryKey: 'pages.newDash.branchInitialization.summary.initialized',
      };
    case 'blocked':
      return {
        statusLabelKey: 'pages.newDash.branchInitialization.status.blocked',
        nextActionLabelKey: 'pages.newDash.branchInitialization.actions.reviewIssues',
        summaryKey: 'pages.newDash.branchInitialization.summary.blocked',
      };
  }
}
