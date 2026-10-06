import {
  AegisClient,
  ComplianceModule,
  createReadOnlyClient,
  decodeContractEvent,
  type AegisClientConfig,
  type InvestorPortfolio,
} from '@aegis/sdk';
import {
  createMockAegisClient,
  createMockFixtures,
  type MockFixtureSet,
} from '@aegis/sdk/testing';

/**
 * Compile-only consumer contract.
 *
 * This file intentionally imports through the package's supported public
 * entrypoints rather than relative src/ paths. If an exported symbol drifts
 * out of the built declarations, `npm run test:public-api` fails.
 */
export type PublicConsumerSurface = {
  clientConstructor: typeof AegisClient;
  complianceModule: typeof ComplianceModule;
  readOnlyFactory: typeof createReadOnlyClient;
  eventDecoder: typeof decodeContractEvent;
  config: AegisClientConfig;
  portfolio: InvestorPortfolio;
  mockFactory: typeof createMockAegisClient;
  fixtureFactory: typeof createMockFixtures;
  fixtures: MockFixtureSet;
};
