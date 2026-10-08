import { rpc } from '@stellar/stellar-sdk';
import { AegisClient } from '../client';
import {
  AegisContractEvent,
  ContractEventInput,
  DecodeContractEventOptions,
} from '../types/contract-event';
import {
  inferPaginationContinuation,
  normalizePaginationInput,
} from '../config/validate';
import type {
  PaginationInput,
  PaginationMetadata,
} from '../types/pagination';
import { decodeContractEvent, decodeContractEvents } from './decoder';

export type FetchContractEventsRequest = Parameters<rpc.Server['getEvents']>[0];

export interface FetchContractEventsOptions
  extends DecodeContractEventOptions,
    PaginationInput {
  startLedger?: number;
}

/**
 * Module for fetching and decoding Aegis contract events from Soroban RPC.
 */
export class EventsModule {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  /**
   * Decodes a raw or parsed Soroban contract event.
   */
  public decode(
    input: ContractEventInput,
    options?: DecodeContractEventOptions
  ): AegisContractEvent {
    return decodeContractEvent(input, options);
  }

  /**
   * Fetches contract events from RPC and decodes them into typed Aegis events.
   *
   * Cursor and limit can be supplied in either the RPC request or the SDK
   * options. Explicit SDK options take precedence and are always validated.
   */
  public async fetchAndDecode(
    request: FetchContractEventsRequest,
    options: FetchContractEventsOptions = {}
  ): Promise<{
    latestLedger: number;
    events: AegisContractEvent[];
    cursor?: string;
    pagination: PaginationMetadata;
  }> {
    const requestWithPaging = request as FetchContractEventsRequest & {
      cursor?: string;
      limit?: number;
      startLedger?: number;
    };

    const pagination = normalizePaginationInput({
      cursor: options.cursor ?? requestWithPaging.cursor,
      limit: options.limit ?? requestWithPaging.limit,
    });

    const rpcRequest = {
      ...request,
      ...(options.startLedger !== undefined
        ? { startLedger: options.startLedger }
        : {}),
      ...(pagination.cursor !== undefined
        ? { cursor: pagination.cursor }
        : {}),
      limit: pagination.limit,
    } as FetchContractEventsRequest;

    const response = await this.client.runNetworkOperation(() =>
      this.client.rpcServer.getEvents(rpcRequest)
    );

    const inputs: ContractEventInput[] = response.events.map((event) => ({
      contractId: event.contractId?.toString(),
      txHash: event.txHash,
      ledger: event.ledger,
      inSuccessfulContractCall: event.inSuccessfulContractCall,
      topic: event.topic,
      value: event.value,
    }));

    const cursor = response.events.at(-1)?.pagingToken;

    return {
      latestLedger: response.latestLedger,
      events: decodeContractEvents(inputs, options),
      cursor,
      pagination: {
        limit: pagination.limit,
        count: response.events.length,
        continuation: inferPaginationContinuation({
          cursor,
          count: response.events.length,
          limit: pagination.limit,
        }),
      },
    };
  }
}
