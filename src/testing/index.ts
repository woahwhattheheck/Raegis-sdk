/**
 * Test utilities for the Aegis SDK.
 *
 * Import from `@aegis/sdk/testing` — not from the main `@aegis/sdk` entry point.
 * See docs/testing.md for usage and export rationale.
 */
export {
  MockAegisClient,
  MockComplianceModule,
  MockAssetModule,
  MockInvestorModule,
  createMockAegisClient,
} from './mock-client';
export type {
  MockAegisClientConfig,
  MockTransactionReceipt,
} from './mock-client';
export {
  MOCK_CONTRACT_ID,
  MOCK_SECONDARY_CONTRACT_ID,
  DEFAULT_MOCK_ASSET_METADATA,
  MOCK_TX_HASH_PREFIX,
  createMockFixtures,
  createDeterministicComplianceFixtures,
  buildMockBooleanSimulationResult,
  buildMockI128SimulationResult,
  buildMockTxHash,
} from './fixtures';
export type {
  MockFixtureSet,
  MockComplianceState,
  MockFixtureRole,
  MockFixtureAccount,
  MockFixtureAccountName,
  MockSimulationResult,
  MockComplianceContractResponse,
  MockComplianceFixture,
  DeterministicComplianceFixtureSet,
} from './fixtures';
