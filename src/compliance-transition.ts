import {
  ComplianceStatus,
  ComplianceStatusTransition,
  ComplianceTransitionAction,
  ComplianceTransitionCode,
} from './types/compliance-transition';

const STATUSES: ReadonlySet<ComplianceStatus> = new Set([
  'approved', 'blocked', 'revoked', 'pending', 'unknown', 'unavailable',
]);

export function isComplianceStatus(value: unknown): value is ComplianceStatus {
  return typeof value === 'string' && STATUSES.has(value as ComplianceStatus);
}

function actionFor(status: ComplianceStatus): ComplianceTransitionAction {
  if (status === 'approved') return 'allow';
  if (status === 'unknown' || status === 'unavailable') return 'refresh';
  return 'deny';
}

function classifyTransition(
  previous: ComplianceStatus,
  current: ComplianceStatus
): { code: ComplianceTransitionCode; reason: string } {
  if (previous === current) {
    return { code: 'NO_CHANGE', reason: `Compliance status remains ${current}.` };
  }
  if (current === 'unavailable') {
    return {
      code: 'STATUS_UNAVAILABLE',
      reason: 'Compliance status became unavailable; refresh before enabling restricted actions.',
    };
  }
  if (previous === 'unavailable') {
    return {
      code: 'STATUS_RECOVERED',
      reason: `Compliance status became readable again as ${current}.`,
    };
  }
  if (current === 'unknown') {
    return {
      code: 'STATUS_UNKNOWN',
      reason: 'Compliance status is unknown; refresh or obtain a more authoritative protocol read.',
    };
  }
  if (previous === 'unknown') {
    return {
      code: 'STATUS_RESOLVED',
      reason: `Previously unknown compliance status resolved to ${current}.`,
    };
  }
  if (current === 'approved') {
    return { code: 'ELIGIBILITY_GRANTED', reason: 'Observed protocol status became approved.' };
  }
  if (previous === 'approved') {
    return {
      code: 'ELIGIBILITY_LOST',
      reason: `Observed protocol status changed from approved to ${current}.`,
    };
  }
  if (current === 'pending') {
    return {
      code: 'REVIEW_PENDING',
      reason: 'Observed protocol status is pending; restricted actions should remain disabled.',
    };
  }
  if (
    (previous === 'blocked' && current === 'revoked') ||
    (previous === 'revoked' && current === 'blocked')
  ) {
    return {
      code: 'RESTRICTION_CHANGED',
      reason: `Observed restriction changed from ${previous} to ${current}.`,
    };
  }
  return {
    code: 'STATUS_CHANGED',
    reason: `Observed protocol status changed from ${previous} to ${current}.`,
  };
}

/**
 * Describes a protocol-state transition for SDK and dashboard consumers.
 * This never grants on-chain authority or infers off-chain compliance.
 */
export function mapComplianceStatusTransition(
  previous: ComplianceStatus,
  current: ComplianceStatus
): ComplianceStatusTransition {
  const wasEligible = previous === 'approved';
  const isEligible = current === 'approved';
  const { code, reason } = classifyTransition(previous, current);
  const action = actionFor(current);

  return {
    previous,
    current,
    changed: previous !== current,
    wasEligible,
    isEligible,
    eligibilityChanged: wasEligible !== isEligible,
    code,
    action,
    requiresRefresh: action === 'refresh',
    reason,
  };
}
