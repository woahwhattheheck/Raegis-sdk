import { Contract, nativeToScVal, rpc, StrKey } from '@stellar/stellar-sdk';
import { AegisClient } from './client';
import { parseSorobanResult } from './utils/xdr-parser';
import type {
  ComplianceEvidenceState,
  ComplianceReadinessCode,
  ComplianceReadinessOperation,
  ComplianceReadinessOptions,
  ComplianceReadinessResult,
  ComplianceReadinessState,
} from './types/compliance';

export class ComplianceModule {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  /**
   * Read the contract's boolean whitelist result.
   * null means that the simulation was unsuccessful, missing, or not a boolean.
   * A failed simulation must never be confused with a confirmed deny.
   */
  private async readWhitelist(address: string): Promise<boolean | null> {
    const contract = new Contract(this.client.contractId);
    const call = contract.call('is_whitelisted', nativeToScVal(address, { type: 'address' }));
    const result = await this.client.runNetworkOperation(() =>
      this.client.rpcServer.simulateTransaction({
        // Preserve the existing SDK invocation adapter for this read-only operation.
        transaction: call as any,
      } as any)
    );

    if (!rpc.Api.isSimulationSuccess(result) || !result.result) return null;
    const decoded: unknown = parseSorobanResult(result.result.retval as any);
    return typeof decoded === 'boolean' ? decoded : null;
  }

  /**
   * Legacy boolean query. For compatibility, a missing/invalid simulation result
   * remains false; prefer checkReadiness() for accurate failure/unknown states.
   * RPC exceptions still propagate through the network-failure boundary.
   */
  public async checkWhitelist(address: string): Promise<boolean> {
    return (await this.readWhitelist(address)) === true;
  }

  /**
   * Evaluate what the SDK can safely show/attempt from observable protocol data.
   * This is NOT legal KYC approval and cannot discover administrator authority.
   */
  public async checkReadiness(
    address: string,
    options: ComplianceReadinessOptions = {},
  ): Promise<ComplianceReadinessResult> {
    const operation: ComplianceReadinessOperation = options.operation ?? 'investor_transfer';
    const checkedAt = new Date().toISOString();
    const valid = typeof address === 'string' && StrKey.isValidEd25519PublicKey(address);

    const result = (
      status: ComplianceReadinessState,
      code: ComplianceReadinessCode,
      onChainWhitelisted: boolean | null,
      evidenceSource: ComplianceReadinessResult['evidenceSource'],
      canAttempt = false,
    ): ComplianceReadinessResult => ({
      address: valid ? address : '',
      status,
      code,
      operation,
      canAttempt,
      onChainWhitelisted,
      evidenceSource,
      checkedAt,
    });

    if (!valid) return result('unknown', 'INVALID_ADDRESS', null, 'none');

    let whitelisted: boolean | null;
    try {
      whitelisted = await this.readWhitelist(address);
    } catch {
      // Do not put provider details, URLs or credentials into dashboard results.
      return result('unavailable', 'RPC_UNAVAILABLE', null, 'none');
    }

    if (whitelisted === null) {
      return result('unavailable', 'SIMULATION_UNAVAILABLE', null, 'none');
    }

    if (whitelisted) {
      // RoleModule explains why a whitelist result does not establish admin rights.
      if (operation === 'admin_action') {
        return result('unknown', 'ADMIN_AUTHORITY_NOT_QUERYABLE', true, 'contract_whitelist');
      }
      return result('approved', 'WHITELIST_APPROVED', true, 'contract_whitelist', true);
    }

    // An on-chain false result only proves this address is not currently
    // whitelisted; it does not reveal *why* (revoked, blocked, or pending).
    if (!options.evidenceLookup) {
      return result('unknown', 'WHITELIST_NOT_APPROVED', false, 'contract_whitelist');
    }

    let evidence: ComplianceEvidenceState;
    try {
      evidence = await options.evidenceLookup(address);
    } catch {
      return result('unknown', 'EVIDENCE_LOOKUP_FAILED', false, 'contract_whitelist');
    }

    const evidenceStatuses: Record<
      ComplianceEvidenceState, { status: ComplianceReadinessState; code: ComplianceReadinessCode }
    > = {
      blocked: { status: 'blocked', code: 'EVIDENCE_BLOCKED' },
      revoked: { status: 'revoked', code: 'EVIDENCE_REVOKED' },
      pending: { status: 'pending', code: 'EVIDENCE_PENDING' },
      unknown: { status: 'unknown', code: 'EVIDENCE_UNKNOWN' },
    };
    // External data is untrusted at runtime; unknown strings fail closed.
    if (typeof evidence !== 'string' || !Object.prototype.hasOwnProperty.call(evidenceStatuses, evidence)) {
      return result('unknown', 'EVIDENCE_UNKNOWN', false, 'contract_whitelist');
    }
    const matched = evidenceStatuses[evidence];
    return result(matched.status, matched.code, false, 'external_evidence');
  }
}
