export type WhitelistObservationStatus =
  | 'approved'
  | 'not-whitelisted'
  | 'unknown'
  | 'unavailable';

export type WhitelistReasonCode =
  | 'WHITELIST_APPROVED'
  | 'NOT_WHITELISTED'
  | 'WHITELIST_RESULT_UNKNOWN'
  | 'WHITELIST_QUERY_UNAVAILABLE';

export interface WhitelistObservation {
  status: WhitelistObservationStatus;
  approved: boolean | null;
  reasonCode: WhitelistReasonCode;
  detail?: string;
}

export type TransferEligibilityStatus =
  | 'eligible'
  | 'ineligible'
  | 'unknown'
  | 'unavailable';

export type TransferEligibilityReasonCode =
  | 'ELIGIBLE'
  | 'INVALID_SOURCE_ADDRESS'
  | 'INVALID_DESTINATION_ADDRESS'
  | 'INVALID_AMOUNT'
  | 'SOURCE_NOT_WHITELISTED'
  | 'SOURCE_COMPLIANCE_UNKNOWN'
  | 'SOURCE_COMPLIANCE_UNAVAILABLE'
  | 'DESTINATION_NOT_WHITELISTED'
  | 'DESTINATION_COMPLIANCE_UNKNOWN'
  | 'DESTINATION_COMPLIANCE_UNAVAILABLE';

export interface InvestorTransferEligibility {
  status: TransferEligibilityStatus;
  eligible: boolean;
  reasonCode: TransferEligibilityReasonCode;
  source?: WhitelistObservation;
  destination?: WhitelistObservation;
}
