export type ComplianceAuditStatus = 'pass' | 'warn' | 'fail' | 'unknown';

export type ComplianceAuditEvidenceSource = 'protocol' | 'sdk' | 'operator';

export interface ComplianceAuditEvidence {
  id: string;
  source: ComplianceAuditEvidenceSource;
  description: string;
  reference?: string;
}

export interface ComplianceAuditCheckInput {
  code: string;
  summary: string;
  status: ComplianceAuditStatus;
  evidenceIds?: readonly string[];
}

export interface ComplianceAuditInput {
  subject: string;
  asOf?: string;
  evidence: readonly ComplianceAuditEvidence[];
  checks: readonly ComplianceAuditCheckInput[];
}

export interface ComplianceAuditSummary {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  unknown: number;
}

export interface ComplianceAuditFinding {
  code: string;
  summary: string;
  status: ComplianceAuditStatus;
  evidenceIds: readonly string[];
}

export interface ComplianceAuditReport {
  schemaVersion: 1;
  subject: string;
  asOf?: string;
  overallStatus: ComplianceAuditStatus;
  summary: ComplianceAuditSummary;
  findings: readonly ComplianceAuditFinding[];
  evidence: readonly ComplianceAuditEvidence[];
  disclaimer: string;
}

export type ComplianceAuditInputErrorCode =
  | 'EMPTY_SUBJECT'
  | 'EMPTY_CHECKS'
  | 'EMPTY_IDENTIFIER'
  | 'DUPLICATE_CHECK_CODE'
  | 'DUPLICATE_EVIDENCE_ID'
  | 'UNKNOWN_EVIDENCE_REFERENCE'
  | 'EVIDENCE_REQUIRED'
  | 'INVALID_STATUS'
  | 'INVALID_EVIDENCE_SOURCE';

export class ComplianceAuditInputError extends Error {
  public readonly code: ComplianceAuditInputErrorCode;

  constructor(code: ComplianceAuditInputErrorCode, message: string) {
    super(message);
    this.name = 'ComplianceAuditInputError';
    this.code = code;
  }
}

export const COMPLIANCE_AUDIT_DISCLAIMER =
  'This report summarizes caller-supplied protocol evidence and is not legal or financial advice.';

const STATUS_RANK: Record<ComplianceAuditStatus, number> = {
  pass: 0,
  warn: 1,
  unknown: 2,
  fail: 3,
};

const EVIDENCE_SOURCES: Record<ComplianceAuditEvidenceSource, true> = {
  protocol: true,
  sdk: true,
  operator: true,
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireIdentifier(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ComplianceAuditInputError(
      'EMPTY_IDENTIFIER',
      field + ' must be a non-empty identifier'
    );
  }
  return normalized;
}

function requireStatus(value: ComplianceAuditStatus, field: string): ComplianceAuditStatus {
  if (!Object.prototype.hasOwnProperty.call(STATUS_RANK, value)) {
    throw new ComplianceAuditInputError(
      'INVALID_STATUS',
      field + ' must be one of pass, warn, fail, unknown'
    );
  }
  return value;
}

function requireEvidenceSource(
  value: ComplianceAuditEvidenceSource,
  field: string
): ComplianceAuditEvidenceSource {
  if (!Object.prototype.hasOwnProperty.call(EVIDENCE_SOURCES, value)) {
    throw new ComplianceAuditInputError(
      'INVALID_EVIDENCE_SOURCE',
      field + ' must be one of protocol, sdk, operator'
    );
  }
  return value;
}

function normalizeEvidence(
  evidence: readonly ComplianceAuditEvidence[]
): ComplianceAuditEvidence[] {
  const seen = new Set<string>();

  return evidence
    .map((item, index) => {
      const id = requireIdentifier(item.id, 'evidence[' + index + '].id');
      if (seen.has(id)) {
        throw new ComplianceAuditInputError(
          'DUPLICATE_EVIDENCE_ID',
          'duplicate evidence id: ' + id
        );
      }
      seen.add(id);

      return {
        ...item,
        id,
        source: requireEvidenceSource(item.source, 'evidence[' + index + '].source'),
        description: item.description.trim(),
        reference: item.reference?.trim() || undefined,
      };
    })
    .sort((left, right) => compareText(left.id, right.id));
}

function normalizeFindings(
  checks: readonly ComplianceAuditCheckInput[],
  evidenceIds: ReadonlySet<string>
): ComplianceAuditFinding[] {
  if (checks.length === 0) {
    throw new ComplianceAuditInputError(
      'EMPTY_CHECKS',
      'at least one compliance check is required'
    );
  }

  const seenCodes = new Set<string>();

  return checks
    .map((check, index) => {
      const code = requireIdentifier(check.code, 'checks[' + index + '].code');
      const status = requireStatus(check.status, code + '.status');
      if (seenCodes.has(code)) {
        throw new ComplianceAuditInputError(
          'DUPLICATE_CHECK_CODE',
          'duplicate check code: ' + code
        );
      }
      seenCodes.add(code);

      const refs = Array.from(
        new Set(
          (check.evidenceIds ?? []).map((id) =>
            requireIdentifier(id, code + '.evidenceId')
          )
        )
      ).sort(compareText);

      for (const evidenceId of refs) {
        if (!evidenceIds.has(evidenceId)) {
          throw new ComplianceAuditInputError(
            'UNKNOWN_EVIDENCE_REFERENCE',
            code + ' references unknown evidence id: ' + evidenceId
          );
        }
      }

      if (status !== 'unknown' && refs.length === 0) {
        throw new ComplianceAuditInputError(
          'EVIDENCE_REQUIRED',
          code + ' requires evidence for status ' + status
        );
      }

      return {
        code,
        summary: check.summary.trim(),
        status,
        evidenceIds: refs,
      };
    })
    .sort((left, right) => compareText(left.code, right.code));
}

function summarize(findings: readonly ComplianceAuditFinding[]): ComplianceAuditSummary {
  const summary: ComplianceAuditSummary = {
    total: findings.length,
    pass: 0,
    warn: 0,
    fail: 0,
    unknown: 0,
  };

  for (const finding of findings) {
    summary[finding.status] += 1;
  }

  return summary;
}

function overallStatus(findings: readonly ComplianceAuditFinding[]): ComplianceAuditStatus {
  let overall: ComplianceAuditStatus = 'pass';

  for (const finding of findings) {
    if (STATUS_RANK[finding.status] > STATUS_RANK[overall]) {
      overall = finding.status;
    }
  }

  return overall;
}

export function buildComplianceAuditReport(input: ComplianceAuditInput): ComplianceAuditReport {
  const subject = input.subject.trim();
  if (!subject) {
    throw new ComplianceAuditInputError('EMPTY_SUBJECT', 'subject must be non-empty');
  }

  const evidence = normalizeEvidence(input.evidence);
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const findings = normalizeFindings(input.checks, evidenceIds);

  return {
    schemaVersion: 1,
    subject,
    asOf: input.asOf?.trim() || undefined,
    overallStatus: overallStatus(findings),
    summary: summarize(findings),
    findings,
    evidence,
    disclaimer: COMPLIANCE_AUDIT_DISCLAIMER,
  };
}
