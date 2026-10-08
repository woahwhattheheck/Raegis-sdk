import { AegisClient } from '../src/client';
import { EventsModule } from '../src/events/module';
import { Networks } from '@stellar/stellar-sdk';
import { contractEventFixtures } from './fixtures/contract-events';

jest.mock('@stellar/stellar-sdk', () => {
  const original = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...original,
    rpc: {
      ...original.rpc,
      Server: jest.fn().mockImplementation(() => ({
        getEvents: jest.fn(),
      })),
    },
  };
});

describe('EventsModule', () => {
  let client: AegisClient;
  let events: EventsModule;
  let mockGetEvents: jest.Mock;

  beforeEach(() => {
    client = new AegisClient({
      environment: 'testnet',
      contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    });
    events = client.events;
    mockGetEvents = client.rpcServer.getEvents as jest.Mock;
  });

  it('delegates decode to the shared decoder', () => {
    const decoded = events.decode(contractEventFixtures.mint());

    expect(decoded.kind).toBe('mint');
  });

  it('applies validated cursor and limit options to the RPC read', async () => {
    const fixture = contractEventFixtures.transfer();
    mockGetEvents.mockResolvedValue({
      latestLedger: 999,
      events: [
        {
          contractId: fixture.contractId,
          txHash: fixture.txHash,
          ledger: fixture.ledger,
          inSuccessfulContractCall: true,
          topic: fixture.topic,
          value: fixture.value,
          pagingToken: 'cursor-1',
        },
      ],
    });

    const result = await events.fetchAndDecode(
      {
        filters: [{ type: 'contract', contractIds: [fixture.contractId!] }],
        startLedger: 1,
      },
      {
        startLedger: 2,
        cursor: 'previous-cursor',
        limit: 1,
      }
    );

    expect(mockGetEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        startLedger: 2,
        cursor: 'previous-cursor',
        limit: 1,
      })
    );
    expect(result.latestLedger).toBe(999);
    expect(result.cursor).toBe('cursor-1');
    expect(result.events[0]).toMatchObject({ kind: 'transfer' });
    expect(result.pagination).toMatchObject({
      limit: 1,
      count: 1,
      continuation: {
        state: 'unknown',
        cursor: 'cursor-1',
      },
    });
  });

  it('rejects an invalid page limit before calling the RPC provider', async () => {
    await expect(
      events.fetchAndDecode(
        { filters: [] },
        { limit: 0 }
      )
    ).rejects.toMatchObject({ code: 'INVALID_LIMIT' });

    expect(mockGetEvents).not.toHaveBeenCalled();
  });
});
