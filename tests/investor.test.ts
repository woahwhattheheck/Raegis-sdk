import { AegisClient } from '../src/client';
import {
  buildMockBooleanSimulationResult,
  buildMockI128SimulationResult,
  createDeterministicComplianceFixtures,
} from '../src/testing/fixtures';
import { Networks, rpc } from '@stellar/stellar-sdk';

jest.mock('@stellar/stellar-sdk', () => {
  const original = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...original,
    rpc: {
      ...original.rpc,
      Server: jest.fn().mockImplementation(() => ({
        simulateTransaction: jest.fn(),
      })),
      Api: {
        ...original.rpc.Api,
        isSimulationSuccess: jest.fn(),
      },
    },
  };
});

describe('InvestorModule (Portfolio Read Model)', () => {
  let client: AegisClient;
  let mockRpcServer: any;

  const fixtures = createDeterministicComplianceFixtures();
  const mockContractId = fixtures.contractId;

  beforeEach(() => {
    jest.clearAllMocks();

    client = new AegisClient({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: Networks.TESTNET,
      contractId: mockContractId,
    });

    mockRpcServer = client.rpcServer;
  });

  describe('Active Portfolio', () => {
    it('should correctly build an active portfolio for a whitelisted investor with balances', async () => {
      (rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(true);

      mockRpcServer.simulateTransaction
        .mockResolvedValueOnce(buildMockBooleanSimulationResult(true))
        .mockResolvedValueOnce(buildMockI128SimulationResult(5_000_000_000n));

      const portfolio = await client.investor.getPortfolio(
        fixtures.accounts.approvedInvestor.address
      );

      expect(portfolio.investorAddress).toBe(
        fixtures.accounts.approvedInvestor.address
      );
      expect(portfolio.status).toBe('active');
      expect(portfolio.isKycApproved).toBe(true);
      expect(portfolio.isBlocked).toBe(false);
      expect(portfolio.totalHoldingsCount).toBe(1);
      expect(portfolio.compliantHoldingsCount).toBe(1);

      const holding = portfolio.holdings[0];
      expect(holding.assetId).toBe(mockContractId);
      expect(holding.balance).toBe('5000000000');
      expect(holding.formattedBalance).toBe('500.00');
      expect(holding.isCompliant).toBe(true);
      expect(holding.transferEligibility.isEligible).toBe(true);
    });
  });

  describe('Empty Portfolio', () => {
    it('should return an empty status portfolio when investor has zero balances', async () => {
      (rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(true);

      mockRpcServer.simulateTransaction
        .mockResolvedValueOnce(buildMockBooleanSimulationResult(true))
        .mockResolvedValueOnce(buildMockI128SimulationResult(0n));

      const portfolio = await client.investor.getPortfolio(
        fixtures.accounts.approvedInvestor.address
      );

      expect(portfolio.status).toBe('empty');
      expect(portfolio.isKycApproved).toBe(true);
      expect(portfolio.isBlocked).toBe(false);
      expect(portfolio.holdings[0].balance).toBe('0');
      expect(portfolio.holdings[0].formattedBalance).toBe('0.00');
      expect(portfolio.holdings[0].transferEligibility.isEligible).toBe(false);
      expect(portfolio.holdings[0].transferEligibility.code).toBe('ZERO_BALANCE');
    });
  });

  describe('Blocked Portfolio', () => {
    it('should return a blocked portfolio state when investor fails KYC/whitelist check', async () => {
      (rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(true);

      mockRpcServer.simulateTransaction
        .mockResolvedValueOnce(buildMockBooleanSimulationResult(false))
        .mockResolvedValueOnce(buildMockI128SimulationResult(1_000_000_000n));

      const portfolio = await client.investor.getPortfolio(
        fixtures.accounts.rejectedInvestor.address
      );

      expect(portfolio.status).toBe('blocked');
      expect(portfolio.isKycApproved).toBe(false);
      expect(portfolio.isBlocked).toBe(true);
      expect(portfolio.holdings[0].isCompliant).toBe(false);
      expect(portfolio.holdings[0].transferEligibility.isEligible).toBe(false);
      expect(portfolio.holdings[0].transferEligibility.code).toBe(
        'NOT_WHITELISTED'
      );
    });
  });

  describe('Unavailable Portfolio', () => {
    it('should safely return unavailable status when RPC simulation fails', async () => {
      mockRpcServer.simulateTransaction.mockRejectedValue(
        new Error('Network RPC Connection Timeout')
      );

      const portfolio = await client.investor.getPortfolio(
        fixtures.accounts.unknownInvestor.address
      );

      expect(portfolio.status).toBe('unavailable');
      expect(portfolio.isKycApproved).toBe(false);
      expect(portfolio.isBlocked).toBe(true);
      expect(portfolio.error).toBe(
        'Compliance status query failed: The network request timed out.'
      );
      expect(portfolio.error).not.toContain('Network RPC Connection Timeout');
      expect(portfolio.holdings).toHaveLength(0);
    });

    it('should handle invalid investor address gracefully', async () => {
      const portfolio = await client.investor.getPortfolio('');

      expect(portfolio.status).toBe('unavailable');
      expect(portfolio.error).toContain('Invalid investor address');
    });
  });
});
