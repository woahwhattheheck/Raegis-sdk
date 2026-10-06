import {
  Account,
  Contract,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { AegisClient } from './client';
import {
  CompliantTransferIntentError,
  CompliantTransferIntentErrorCode,
} from './errors/transfer-intent';
import { CompliantTransferIntent } from './types/transfer-intent';

export class AssetModule {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  private transferError(
    code: CompliantTransferIntentErrorCode,
    message: string,
  ): CompliantTransferIntentError {
    return new CompliantTransferIntentError(code, message);
  }

  private validateTransferInput(to: string, amount: number): void {
    if (!StrKey.isValidEd25519PublicKey(to)) {
      throw this.transferError(
        'INVALID_RECIPIENT',
        'Transfer recipient must be a valid Stellar G-address.',
      );
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw this.transferError(
        'INVALID_AMOUNT',
        'Transfer amount must be a positive safe integer.',
      );
    }
  }

  private validateTransferConfig(): void {
    if (!StrKey.isValidContract(this.client.contractId)) {
      throw this.transferError(
        'INVALID_CONTRACT',
        'A valid Stellar contract ID is required before building a transfer intent.',
      );
    }
    if (
      typeof this.client.networkPassphrase !== 'string' ||
      this.client.networkPassphrase.trim().length === 0
    ) {
      throw this.transferError(
        'INVALID_NETWORK',
        'A non-empty Stellar network passphrase is required before building a transfer intent.',
      );
    }
  }

  private async requireCompliant(
    address: string,
    code: 'SENDER_NOT_COMPLIANT' | 'RECIPIENT_NOT_COMPLIANT',
    label: 'sender' | 'recipient',
  ): Promise<void> {
    let compliant: boolean;
    try {
      compliant = await this.client.compliance.checkWhitelist(address);
    } catch {
      throw this.transferError(
        'COMPLIANCE_CHECK_FAILED',
        `Unable to verify ${label} compliance; transfer intent was not built.`,
      );
    }
    if (!compliant) {
      throw this.transferError(
        code,
        `Transfer ${label} is not currently approved by the protocol whitelist.`,
      );
    }
  }

  /**
   * Builds a transfer intent only after validating inputs, configuration, and
   * both protocol whitelist checks. Sender is checked first so a rejected
   * sender never triggers a recipient lookup.
   */
  public async buildTransferIntent(
    to: string,
    amount: number,
  ): Promise<CompliantTransferIntent> {
    const signer = this.client.requireSigner();
    this.validateTransferInput(to, amount);
    this.validateTransferConfig();

    const sender = signer.publicKey();
    await this.requireCompliant(sender, 'SENDER_NOT_COMPLIANT', 'sender');
    await this.requireCompliant(to, 'RECIPIENT_NOT_COMPLIANT', 'recipient');

    return Object.freeze({
      sender,
      recipient: to,
      amount,
      contractId: this.client.contractId,
      networkPassphrase: this.client.networkPassphrase,
      compliance: Object.freeze({
        sender: true as const,
        recipient: true as const,
      }),
    });
  }

  /**
   * Submits a previously-built compliant intent. The signer, contract, and
   * network are rebound to the current client and must still match the intent,
   * preventing a checked intent from being replayed under different config.
   */
  public async submitTransferIntent(
    intent: CompliantTransferIntent,
  ): Promise<string> {
    const signer = this.client.requireSigner();
    this.validateTransferInput(intent.recipient, intent.amount);
    this.validateTransferConfig();

    if (
      intent.sender !== signer.publicKey() ||
      intent.contractId !== this.client.contractId ||
      intent.networkPassphrase !== this.client.networkPassphrase
    ) {
      throw this.transferError(
        'INTENT_CONFIG_MISMATCH',
        'Transfer intent no longer matches the configured signer, contract, or network.',
      );
    }

    const contract = new Contract(this.client.contractId);
    const call = contract.call(
      'transfer',
      nativeToScVal(signer.publicKey(), { type: 'address' }),
      nativeToScVal(intent.recipient, { type: 'address' }),
      nativeToScVal(intent.amount, { type: 'i128' }),
    );

    const sourceAccount = new Account(signer.publicKey(), '0');
    const tx = new TransactionBuilder(sourceAccount, {
      fee: '1000',
      networkPassphrase: this.client.networkPassphrase,
    })
      .addOperation(call)
      .setTimeout(30)
      .build();

    tx.sign(signer);

    try {
      const response = await this.client.rpcServer.sendTransaction(tx);
      return response.hash;
    } catch (error) {
      throw new Error(`Transfer transaction failed: ${error}`);
    }
  }

  /**
   * Submits a transaction to mint new RWA tokens.
   * @param to Stellar public key of the recipient.
   * @param amount Amount to mint.
   */
  public async mint(to: string, amount: number): Promise<string> {
    const signer = this.client.requireSigner();
    const contract = new Contract(this.client.contractId);

    const call = contract.call(
      'mint_asset',
      nativeToScVal(signer.publicKey(), { type: 'address' }),
      nativeToScVal(to, { type: 'address' }),
      nativeToScVal(amount, { type: 'i128' }),
    );

    // TODO: Implement transaction simulation endpoint before submitting to check for auth/whitelist failures

    // Note: In production, you must fetch the real sequence number for the account
    const sourceAccount = new Account(signer.publicKey(), '0');

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '1000',
      networkPassphrase: this.client.networkPassphrase,
    })
      .addOperation(call)
      .setTimeout(30)
      .build();

    tx.sign(signer);

    try {
      const response = await this.client.rpcServer.sendTransaction(tx);
      return response.hash;
    } catch (error) {
      throw new Error(`Mint transaction failed: ${error}`);
    }
  }

  /**
   * Transfers RWA tokens to another whitelisted address.
   * The legacy convenience method now routes through the compliant intent
   * preflight before transaction construction/submission.
   */
  public async transfer(to: string, amount: number): Promise<string> {
    const intent = await this.buildTransferIntent(to, amount);
    return this.submitTransferIntent(intent);
  }
}
