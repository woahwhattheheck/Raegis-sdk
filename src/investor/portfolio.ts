import { Contract, nativeToScVal, rpc, StrKey } from '@stellar/stellar-sdk';
import { AegisClient } from '../client';
import {
  InvestorPortfolio,
  PortfolioStatus,
  AssetHolding,
  AssetMetadata,
  FetchPortfolioOptions,
  TransferEligibility,
} from '../types/portfolio';
import {
  InvestorTransferEligibility,
  WhitelistObservation,
} from '../types/transfer-eligibility';
import { parseSorobanResult } from '../utils/xdr-parser';

export class InvestorModule {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  public async checkTransferEligibility(
    source: string,
    destination: string,
    amount: number,
  ): Promise<InvestorTransferEligibility> {
    if (!StrKey.isValidEd25519PublicKey(source)) {
      return { status: 'ineligible', eligible: false, reasonCode: 'INVALID_SOURCE_ADDRESS' };
    }
    if (!StrKey.isValidEd25519PublicKey(destination)) {
      return { status: 'ineligible', eligible: false, reasonCode: 'INVALID_DESTINATION_ADDRESS' };
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return { status: 'ineligible', eligible: false, reasonCode: 'INVALID_AMOUNT' };
    }

    const sourceObservation = await this.client.compliance.observeWhitelist(source);
    const sourceResult = this.mapWhitelistObservation('SOURCE', sourceObservation);
    if (sourceResult) {
      return { ...sourceResult, source: sourceObservation };
    }

    const destinationObservation =
      await this.client.compliance.observeWhitelist(destination);
    const destinationResult = this.mapWhitelistObservation(
      'DESTINATION',
      destinationObservation,
    );
    if (destinationResult) {
      return {
        ...destinationResult,
        source: sourceObservation,
        destination: destinationObservation,
      };
    }

    return {
      status: 'eligible',
      eligible: true,
      reasonCode: 'ELIGIBLE',
      source: sourceObservation,
      destination: destinationObservation,
    };
  }

  private mapWhitelistObservation(
    side: 'SOURCE' | 'DESTINATION',
    observation: WhitelistObservation,
  ): Omit<InvestorTransferEligibility, 'source' | 'destination'> | null {
    switch (observation.status) {
      case 'approved':
        return null;
      case 'not-whitelisted':
        return {
          status: 'ineligible',
          eligible: false,
          reasonCode: `${side}_NOT_WHITELISTED`,
        };
      case 'unknown':
        return {
          status: 'unknown',
          eligible: false,
          reasonCode: `${side}_COMPLIANCE_UNKNOWN`,
        };
      case 'unavailable':
        return {
          status: 'unavailable',
          eligible: false,
          reasonCode: `${side}_COMPLIANCE_UNAVAILABLE`,
        };
    }
  }

  public async getPortfolio(
    investorAddress: string,
    options: FetchPortfolioOptions = {}
  ): Promise<InvestorPortfolio> {
    const fetchedAt = new Date().toISOString();

    if (!investorAddress || typeof investorAddress !== 'string') {
      return this.buildUnavailablePortfolio(
        investorAddress || '',
        'Invalid investor address provided.',
        fetchedAt
      );
    }

    let isKycApproved = false;
    let isBlocked = false;

    try {
      isKycApproved = await this.client.compliance.checkWhitelist(investorAddress);
      isBlocked = !isKycApproved;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.buildUnavailablePortfolio(
        investorAddress,
        `Compliance status query failed: ${errorMsg}`,
        fetchedAt
      );
    }

    const targetAssetContracts = options.assetContractIds && options.assetContractIds.length > 0
      ? options.assetContractIds
      : [this.client.contractId];

    const holdings: AssetHolding[] = [];

    for (const contractId of targetAssetContracts) {
      try {
        const holding = await this.fetchAssetHolding(
          contractId,
          investorAddress,
          isKycApproved,
          options.includeMetadata !== false
        );
        if (holding) {
          holdings.push(holding);
        }
      } catch {
        const fallbackHolding: AssetHolding = {
          assetId: contractId,
          balance: '0',
          formattedBalance: '0.00',
          metadata: {
            symbol: 'UNKNOWN',
            name: 'Unavailable Asset',
            decimals: 7,
            isRwa: true,
            contractId,
          },
          isCompliant: isKycApproved,
          transferEligibility: {
            isEligible: false,
            reason: 'Asset state query failed.',
            code: 'QUERY_FAILED',
          },
        };
        holdings.push(fallbackHolding);
      }
    }

    const totalHoldingsCount = holdings.length;
    const compliantHoldingsCount = holdings.filter((h) => h.isCompliant).length;
    const activeHoldings = holdings.filter((h) => BigInt(h.balance) > 0n);

    let status: PortfolioStatus;
    if (isBlocked) {
      status = 'blocked';
    } else if (activeHoldings.length === 0) {
      status = 'empty';
    } else {
      status = 'active';
    }

    return {
      investorAddress,
      status,
      totalHoldingsCount,
      compliantHoldingsCount,
      holdings,
      isKycApproved,
      isBlocked,
      fetchedAt,
    };
  }

  private async fetchAssetHolding(
    contractId: string,
    investorAddress: string,
    isKycApproved: boolean,
    includeMetadata: boolean
  ): Promise<AssetHolding | null> {
    const contract = new Contract(contractId);
    const call = contract.call(
      'balance',
      nativeToScVal(investorAddress, { type: 'address' })
    );

    let balanceRaw = '0';

    try {
      const result = await this.client.rpcServer.simulateTransaction({
        transaction: call as any,
      } as any);

      if (rpc.Api.isSimulationSuccess(result) && result.result) {
        const parsed = parseSorobanResult(result.result.retval as any);
        balanceRaw = parsed !== null && parsed !== undefined ? String(parsed) : '0';
      }
    } catch {
      balanceRaw = '0';
    }

    const metadata: AssetMetadata = includeMetadata
      ? await this.fetchAssetMetadata(contractId)
      : {
          symbol: 'RWA',
          name: 'Real World Asset',
          decimals: 7,
          isRwa: true,
          contractId,
        };

    const formattedBalance = this.formatBalance(balanceRaw, metadata.decimals);
    const isEligible = isKycApproved && BigInt(balanceRaw) > 0n;

    const transferEligibility: TransferEligibility = {
      isEligible,
      reason: !isKycApproved
        ? 'Investor is not KYC approved.'
        : BigInt(balanceRaw) <= 0n
        ? 'Insufficient asset balance.'
        : undefined,
      code: !isKycApproved
        ? 'NOT_WHITELISTED'
        : BigInt(balanceRaw) <= 0n
        ? 'ZERO_BALANCE'
        : undefined,
    };

    return {
      assetId: contractId,
      balance: balanceRaw,
      formattedBalance,
      metadata,
      isCompliant: isKycApproved,
      transferEligibility,
    };
  }

  private async fetchAssetMetadata(contractId: string): Promise<AssetMetadata> {
    return {
      symbol: 'AEGIS-RWA',
      name: 'Aegis Tokenized Real Estate',
      decimals: 7,
      isRwa: true,
      category: 'Real Estate',
      contractId,
    };
  }

  private formatBalance(rawBalance: string, decimals: number): string {
    try {
      const bigIntBal = BigInt(rawBalance);
      if (bigIntBal === 0n) return '0.00';

      const factor = BigInt(10 ** decimals);
      const integerPart = (bigIntBal / factor).toString();
      const fractionalPart = (bigIntBal % factor)
        .toString()
        .padStart(decimals, '0')
        .slice(0, 2);

      return `${integerPart}.${fractionalPart}`;
    } catch {
      return '0.00';
    }
  }

  private buildUnavailablePortfolio(
    investorAddress: string,
    errorReason: string,
    fetchedAt: string
  ): InvestorPortfolio {
    return {
      investorAddress,
      status: 'unavailable',
      totalHoldingsCount: 0,
      compliantHoldingsCount: 0,
      holdings: [],
      isKycApproved: false,
      isBlocked: true,
      fetchedAt,
      error: errorReason,
    };
  }
}
