/**
 * Conservative, dashboard-friendly compliance readiness for investor/admin actions.
 *
 * The contract currently exposes only a boolean whitelist query. In particular,
 * a false result does NOT prove that a person was blocked or revoked.
 */
export type ComplianceReadinessState =
  | 'approved'
  | 'blocked'
  | 'revoked'
  | 'pending'
  | 'unknown'
  | 'unavailable';

export type ComplianceReadinessOperation = 'investor_transfer' | 'admin_action';

export type ComplianceReadinessCode =
  | 'WHITELIST_APPROVED'
  | 'WHITELIST_NOT_APPROVED'
  | 'EVIDENCE_BLOCKED'
  | 'EVIDENCE_REVOKED'
  | 'EVIDENCE_PENDING'
  | 'EVIDENCE_UNKNOWN'
  | 'EVIDENCE_LOOKUP_FAILED'
  | 'INVALID_ADDRESS'
  | 'SIMULATION_UNAVAILABLE'
  | 'RPC_UNAVAILABLE'
  | 'ADMIN_AUTHORITY_NOT_QUERYABLE';

export type ComplianceEvidenceState = 'blocked' | 'revoked' | 'pending' | 'unknown';

/**
 * Optional evidence from an independent issuer/compliance provider.
 * The SDK cannot verify this provider's identity or legal KYC process.
 * Never treat the evidence as a smart-contract authorization.
 */
export type ComplianceEvidenceLookup =
  (address: string) => Promise<ComplianceEvidenceState>;

export interface ComplianceReadinessOptions {
  /** Whitelist alone cannot prove admin/issuer rights. Defaults to investor_transfer. */
  operation?: ComplianceReadinessOperation;
  /** Only used to distinguish why a contract whitelist returned false. */
  evidenceLookup?: ComplianceEvidenceLookup;
}

/** A conservative snapshot, never a guarantee of legal or on-chain authority. */
export interface ComplianceReadinessResult {
  /** Valid Stellar address, or an empty string when input validation failed. */
  address: string;
  status: ComplianceReadinessState;
  code: ComplianceReadinessCode;
  operation: ComplianceReadinessOperation;
  /** False for all unknown, unavailable and non-approved cases. */
  canAttempt: boolean;
  /** null when there was no unambiguous on-chain boolean result. */
  onChainWhitelisted: boolean | null;
  /** Source of the displayed state, not legal or regulatory verification. */
  evidenceSource: 'contract_whitelist' | 'external_evidence' | 'none';
  checkedAt: string;
}
