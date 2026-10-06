import { Contract, nativeToScVal, rpc } from '@stellar/stellar-sdk';
import { AegisClient } from './client';
import { WhitelistObservation } from './types/transfer-eligibility';
import { parseSorobanResult } from './utils/xdr-parser';

export class ComplianceModule {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  public async observeWhitelist(address: string): Promise<WhitelistObservation> {
    const contract = new Contract(this.client.contractId);
    const call = contract.call(
      'is_whitelisted',
      nativeToScVal(address, { type: 'address' }),
    );

    try {
      const result = await this.client.runNetworkOperation(() =>
        this.client.rpcServer.simulateTransaction({
          transaction: call as any,
        } as any),
      );

      if (rpc.Api.isSimulationSuccess(result) && result.result) {
        const parsed = parseSorobanResult(result.result.retval as any);
        if (parsed === true) {
          return { status: 'approved', approved: true, reasonCode: 'WHITELIST_APPROVED' };
        }
        if (parsed === false) {
          return { status: 'not-whitelisted', approved: false, reasonCode: 'NOT_WHITELISTED' };
        }
      }

      return { status: 'unknown', approved: null, reasonCode: 'WHITELIST_RESULT_UNKNOWN' };
    } catch (error) {
      return {
        status: 'unavailable',
        approved: null,
        reasonCode: 'WHITELIST_QUERY_UNAVAILABLE',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public async checkWhitelist(address: string): Promise<boolean> {
    const observation = await this.observeWhitelist(address);
    return observation.status === 'approved';
  }
}
