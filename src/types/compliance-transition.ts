/** Protocol-facing compliance states used by the SDK transition mapper. */
export type ComplianceStatus =
  | 'approved'
  | 'blocked'
  | 'revoked'
  | 'pending'
  | 'unknown'
  | 'unavailable';

export type ComplianceTransitionCode =
  | 'NO_CHANGE'
  | 'ELIGIBILITY_GRANTED'
  | 'ELIGIBILITY_LOST'
  | 'REVIEW_PENDING'
  | 'RESTRICTION_CHANGED'
  | 'STATUS_UNAVAILABLE'
  | 'STATUS_RECOVERED'
  | 'STATUS_UNKNOWN'
  | 'STATUS_RESOLVED'
  | 'STATUS_CHANGED';

export type ComplianceTransitionAction = 'allow' | 'deny' | 'refresh';

export interface ComplianceStatusTransition {
  previous: ComplianceStatus;
  current: ComplianceStatus;
  changed: boolean;
  wasEligible: boolean;
  isEligible: boolean;
  eligibilityChanged: boolean;
  code: ComplianceTransitionCode;
  action: ComplianceTransitionAction;
  requiresRefresh: boolean;
  reason: string;
}
