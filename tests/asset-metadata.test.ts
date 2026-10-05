import {
  AssetMetadataValidationError,
  parseRwaAssetMetadata,
  rwaAssetMetadataSchema,
} from '../src';
import {
  VALID_RWA_ISSUER,
  validRwaAssetMetadataInput,
} from './fixtures/rwa-metadata';

describe('RWA asset metadata schema', () => {
  it('normalizes valid metadata without losing supply precision', () => {
    const metadata = parseRwaAssetMetadata({
      ...validRwaAssetMetadataInput,
      symbol: '  ust-6m  ',
    });

    expect(metadata).toEqual({
      ...validRwaAssetMetadataInput,
      symbol: 'UST-6M',
      supply: 1000000000000n,
    });
  });

  it('accepts zero and the maximum non-negative i128 supply', () => {
    const maxI128 = (1n << 127n) - 1n;

    expect(
      parseRwaAssetMetadata({
        ...validRwaAssetMetadataInput,
        supply: 0n,
      }).supply
    ).toBe(0n);

    expect(
      parseRwaAssetMetadata({
        ...validRwaAssetMetadataInput,
        supply: maxI128.toString(),
      }).supply
    ).toBe(maxI128);
  });

  it('returns a typed issuer error for an invalid account', () => {
    expect(() =>
      parseRwaAssetMetadata({
        ...validRwaAssetMetadataInput,
        issuer: 'not-a-stellar-address',
      })
    ).toThrow(AssetMetadataValidationError);

    try {
      parseRwaAssetMetadata({
        ...validRwaAssetMetadataInput,
        issuer: 'not-a-stellar-address',
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_ISSUER',
        field: 'issuer',
      });
    }
  });

  it('rejects a shape-valid issuer with an invalid StrKey checksum', () => {
    const badChecksumIssuer = `${VALID_RWA_ISSUER.slice(0, -1)}A`;

    expect(badChecksumIssuer).toMatch(/^G[A-Z2-7]{55}$/);
    expect(
      rwaAssetMetadataSchema.safeParse({
        ...validRwaAssetMetadataInput,
        issuer: badChecksumIssuer,
      })
    ).toMatchObject({
      success: false,
      error: { code: 'INVALID_ISSUER', field: 'issuer' },
    });
  });

  it('rejects malformed symbols and unknown lifecycle states', () => {
    expect(
      rwaAssetMetadataSchema.safeParse({
        ...validRwaAssetMetadataInput,
        symbol: 'A',
      })
    ).toMatchObject({
      success: false,
      error: { code: 'INVALID_SYMBOL', field: 'symbol' },
    });

    expect(
      rwaAssetMetadataSchema.safeParse({
        ...validRwaAssetMetadataInput,
        status: 'approved',
      })
    ).toMatchObject({
      success: false,
      error: { code: 'INVALID_STATUS', field: 'status' },
    });
  });

  it('rejects names outside the documented bounds', () => {
    const result = rwaAssetMetadataSchema.safeParse({
      ...validRwaAssetMetadataInput,
      name: 'x',
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INVALID_NAME', field: 'name' },
    });
  });

  it('rejects negative, overflowed, and precision-losing supply inputs', () => {
    const invalidSupplies = [
      '-1',
      (1n << 127n).toString(),
      Number.MAX_SAFE_INTEGER + 1,
    ];

    for (const supply of invalidSupplies) {
      const result = rwaAssetMetadataSchema.safeParse({
        ...validRwaAssetMetadataInput,
        supply,
      });

      expect(result).toMatchObject({
        success: false,
        error: { code: 'INVALID_SUPPLY', field: 'supply' },
      });
    }
  });

  it('preserves a valid issuer verbatim', () => {
    expect(parseRwaAssetMetadata(validRwaAssetMetadataInput).issuer).toBe(
      VALID_RWA_ISSUER
    );
  });
});
