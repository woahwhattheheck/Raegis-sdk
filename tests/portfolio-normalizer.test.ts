import {
  formatPortfolioBalance,
  getPortfolioHoldingDisplayLabel,
  normalizeInvestorPortfolio,
  normalizePortfolioHolding,
} from '../src/investor/normalizer';

describe('portfolio normalizer', () => {
  it('normalizes camelCase and snake_case contract ID aliases into the same shape', () => {
    const canonical = normalizePortfolioHolding({
      contractId: 'C_ASSET',
      balance: '123450000',
      metadata: {
        symbol: 'RWA',
        name: 'Real Asset',
        decimals: 7,
        category: 'real-estate',
      },
    });

    const legacy = normalizePortfolioHolding({
      contract_id: 'C_ASSET',
      raw_balance: '123450000',
      asset_symbol: 'RWA',
      asset_name: 'Real Asset',
      asset_decimals: '7',
      asset_category: 'real-estate',
    });

    expect(canonical).toEqual(legacy);
    expect(canonical).toMatchObject({
      status: 'supported',
      assetId: 'C_ASSET',
      balance: '123450000',
      decimalBalance: '12.345',
      metadata: {
        symbol: 'RWA',
        name: 'Real Asset',
        decimals: 7,
        category: 'real-estate',
        contractId: 'C_ASSET',
      },
    });
  });

  it('uses a later alias when an earlier alias is nullish', () => {
    const holding = normalizePortfolioHolding({
      assetId: null,
      contract_id: 'C_FALLBACK',
      balance: null,
      raw_balance: '250',
      asset: { symbol: 'FALL', decimals: 2 },
    });

    expect(holding.status).toBe('supported');
    expect(holding.assetId).toBe('C_FALLBACK');
    expect(holding.balance).toBe('250');
    expect(holding.decimalBalance).toBe('2.5');
  });
  it('preserves unknown rows instead of silently dropping them', () => {
    const holding = normalizePortfolioHolding({
      balance: '50000000',
      metadata: { symbol: 'MYSTERY', decimals: 7 },
    });

    expect(holding.status).toBe('unknown');
    expect(holding.code).toBe('MISSING_ASSET_ID');
    expect(holding.assetId).toBeNull();
    expect(holding.balance).toBe('50000000');
    expect(holding.decimalBalance).toBe('5');
    expect(getPortfolioHoldingDisplayLabel(holding)).toBe('MYSTERY');
  });

  it.each([
    [
      { balance: '1', supported: false },
      'UNSUPPORTED_ASSET',
    ],
    [
      { assetId: 'C_DISABLED', balance: '1', supported: false },
      'UNSUPPORTED_ASSET',
    ],
    [
      { assetId: 'C_BAD_BALANCE', balance: '1.25', decimals: 7 },
      'INVALID_BALANCE',
    ],
    [
      { assetId: 'C_BAD_DECIMALS', balance: '10', decimals: 100 },
      'INVALID_DECIMALS',
    ],
  ])('marks unsupported holding shapes explicitly', (input, code) => {
    expect(normalizePortfolioHolding(input)).toMatchObject({
      status: 'unsupported',
      code,
    });
  });

  it('formats signed base-unit balances exactly and locale-neutrally', () => {
    expect(formatPortfolioBalance('0', 7)).toBe('0');
    expect(formatPortfolioBalance('123450000', 7)).toBe('12.345');
    expect(formatPortfolioBalance('-5000000', 7)).toBe('-0.5');
    expect(formatPortfolioBalance('42', 0)).toBe('42');
  });

  it('reports ready, partial, unusable, and empty portfolio states', () => {
    const supported = { assetId: 'C_OK', balance: '10000000', decimals: 7 };
    const unknown = { balance: '10000000', decimals: 7 };
    const unsupported = { assetId: 'C_BAD', balance: 'not-a-number', decimals: 7 };

    expect(normalizeInvestorPortfolio([]).state).toBe('empty');
    expect(normalizeInvestorPortfolio([supported]).state).toBe('ready');

    const partial = normalizeInvestorPortfolio([supported, unknown, unsupported]);
    expect(partial).toMatchObject({
      state: 'partial',
      totalHoldingsCount: 3,
      supportedHoldingsCount: 1,
      unknownHoldingsCount: 1,
      unsupportedHoldingsCount: 1,
    });

    expect(normalizeInvestorPortfolio([unknown, unsupported]).state).toBe('unusable');
  });

  it('preserves source order and supports an explicit default precision', () => {
    const normalized = normalizeInvestorPortfolio(
      [
        { asset_id: 'C_SECOND', amount: '250' },
        { asset_id: 'C_FIRST', amount: '100' },
      ],
      { defaultDecimals: 2 },
    );

    expect(normalized.holdings.map((holding) => holding.assetId)).toEqual([
      'C_SECOND',
      'C_FIRST',
    ]);
    expect(normalized.holdings.map((holding) => holding.decimalBalance)).toEqual([
      '2.5',
      '1',
    ]);
  });
});
