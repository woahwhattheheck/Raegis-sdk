import { Keypair, xdr } from '@stellar/stellar-sdk';
import { AssetMetadata } from '../types/portfolio';

/**
 * Placeholder contract ID for local tests. Not a live deployment.
 */
export const MOCK_CONTRACT_ID =
  'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

/**
 * Secondary placeholder contract ID for multi-asset portfolio tests.
 */
export const MOCK_SECONDARY_CONTRACT_ID =
  'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

/**
 * Default asset metadata returned by the mock client.
 */
export const DEFAULT_MOCK_ASSET_METADATA: AssetMetadata = {
  symbol: 'AEGIS-RWA',
  name: 'Aegis Tokenized Real Estate',
  decimals: 7,
  isRwa: true,
  category: 'Real Estate',
  contractId: MOCK_CONTRACT_ID,
};

/**
 * Deterministic fake transaction hash prefix. Hashes are not from a live network.
 */
export const MOCK_TX_HASH_PREFIX = 'mock_tx_';

export type MockComplianceState =
  | 'approved'
  | 'rejected'
  | 'pending'
  | 'unknown'
  | 'unauthorised'
  | 'invalid';

export type MockFixtureRole = 'admin' | 'investor';

export interface MockFixtureAccount {
  role: MockFixtureRole;
  address: string;
}

export type MockFixtureAccountName =
  | 'admin'
  | 'approvedInvestor'
  | 'rejectedInvestor'
  | 'pendingInvestor'
  | 'unknownInvestor'
  | 'unauthorisedInvestor'
  | 'invalidInvestor';

export interface MockSimulationResult {
  result: {
    retval: string;
  };
}

export type MockComplianceContractResponse =
  | {
      kind: 'success';
      simulation: MockSimulationResult;
    }
  | {
      kind: 'pending';
      retryAfterLedgers: number;
    }
  | {
      kind: 'unknown';
    }
  | {
      kind: 'error';
      code: 'UNAUTHORISED' | 'INVALID_ADDRESS';
      message: string;
    };

export interface MockComplianceFixture {
  state: MockComplianceState;
  address: string;
  whitelisted: boolean | null;
  contractResponse: MockComplianceContractResponse;
}

export interface DeterministicComplianceFixtureSet {
  contractId: string;
  secondaryContractId: string;
  accounts: Record<MockFixtureAccountName, MockFixtureAccount>;
  compliance: Record<MockComplianceState, MockComplianceFixture>;
  assetMetadata: {
    primary: AssetMetadata;
    secondary: AssetMetadata;
  };
}

export interface MockFixtureSet {
  contractId: string;
  signer: Keypair;
  investorAddress: string;
  secondaryInvestorAddress: string;
}

function deterministicPublicKey(seedByte: number): string {
  const seed = new Uint8Array(32);
  seed.fill(seedByte);
  return Keypair.fromRawEd25519Seed(seed).publicKey();
}

/**
 * Builds the minimal simulation-success shape used by SDK whitelist tests.
 */
export function buildMockBooleanSimulationResult(
  value: boolean
): MockSimulationResult {
  return {
    result: {
      retval: xdr.ScVal.scvBool(value).toXDR('base64'),
    },
  };
}

/**
 * Builds a positive i128 simulation result for deterministic balance tests.
 */
export function buildMockI128SimulationResult(
  value: bigint | number | string
): MockSimulationResult {
  const parsed = BigInt(value);
  const maxI128 = (1n << 127n) - 1n;

  if (parsed < 0n || parsed > maxI128) {
    throw new RangeError('Mock i128 fixture value must be between 0 and 2^127 - 1.');
  }

  const lowMask = (1n << 64n) - 1n;
  const high = parsed >> 64n;
  const low = parsed & lowMask;

  return {
    result: {
      retval: xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          hi: xdr.Int64.fromString(high.toString()),
          lo: xdr.Uint64.fromString(low.toString()),
        })
      ).toXDR('base64'),
    },
  };
}

/**
 * Creates reusable, deterministic public test scenarios.
 *
 * Account addresses come from fixed synthetic seeds so they are stable across runs.
 * No credential strings are returned or serialized by this fixture set. Do not fund
 * or reuse these addresses outside tests.
 */
export function createDeterministicComplianceFixtures(): DeterministicComplianceFixtureSet {
  const accounts: Record<MockFixtureAccountName, MockFixtureAccount> = {
    admin: { role: 'admin', address: deterministicPublicKey(1) },
    approvedInvestor: { role: 'investor', address: deterministicPublicKey(2) },
    rejectedInvestor: { role: 'investor', address: deterministicPublicKey(3) },
    pendingInvestor: { role: 'investor', address: deterministicPublicKey(4) },
    unknownInvestor: { role: 'investor', address: deterministicPublicKey(5) },
    unauthorisedInvestor: {
      role: 'investor',
      address: deterministicPublicKey(6),
    },
    invalidInvestor: { role: 'investor', address: 'not-a-stellar-address' },
  };

  const compliance: Record<MockComplianceState, MockComplianceFixture> = {
    approved: {
      state: 'approved',
      address: accounts.approvedInvestor.address,
      whitelisted: true,
      contractResponse: {
        kind: 'success',
        simulation: buildMockBooleanSimulationResult(true),
      },
    },
    rejected: {
      state: 'rejected',
      address: accounts.rejectedInvestor.address,
      whitelisted: false,
      contractResponse: {
        kind: 'success',
        simulation: buildMockBooleanSimulationResult(false),
      },
    },
    pending: {
      state: 'pending',
      address: accounts.pendingInvestor.address,
      whitelisted: null,
      contractResponse: {
        kind: 'pending',
        retryAfterLedgers: 1,
      },
    },
    unknown: {
      state: 'unknown',
      address: accounts.unknownInvestor.address,
      whitelisted: null,
      contractResponse: {
        kind: 'unknown',
      },
    },
    unauthorised: {
      state: 'unauthorised',
      address: accounts.unauthorisedInvestor.address,
      whitelisted: null,
      contractResponse: {
        kind: 'error',
        code: 'UNAUTHORISED',
        message: 'The fixture caller is not authorised for this compliance operation.',
      },
    },
    invalid: {
      state: 'invalid',
      address: accounts.invalidInvestor.address,
      whitelisted: null,
      contractResponse: {
        kind: 'error',
        code: 'INVALID_ADDRESS',
        message: 'The fixture address is not a valid Stellar public key.',
      },
    },
  };

  return {
    contractId: MOCK_CONTRACT_ID,
    secondaryContractId: MOCK_SECONDARY_CONTRACT_ID,
    accounts,
    compliance,
    assetMetadata: {
      primary: { ...DEFAULT_MOCK_ASSET_METADATA },
      secondary: {
        symbol: 'AEGIS-CREDIT',
        name: 'Aegis Carbon Credit',
        decimals: 7,
        isRwa: true,
        category: 'Environmental Asset',
        contractId: MOCK_SECONDARY_CONTRACT_ID,
      },
    },
  };
}

/**
 * Creates a fresh set of fake keypairs and addresses for tests or examples.
 * Generated credentials are ephemeral and must not be used on mainnet.
 */
export function createMockFixtures(): MockFixtureSet {
  const signer = Keypair.random();
  const investor = Keypair.random();
  const secondaryInvestor = Keypair.random();

  return {
    contractId: MOCK_CONTRACT_ID,
    signer,
    investorAddress: investor.publicKey(),
    secondaryInvestorAddress: secondaryInvestor.publicKey(),
  };
}

/**
 * Builds a predictable mock transaction hash for assertions.
 */
export function buildMockTxHash(sequence: number, type: 'mint' | 'transfer'): string {
  return MOCK_TX_HASH_PREFIX + type + '_' + sequence;
}
