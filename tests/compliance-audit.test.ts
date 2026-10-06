import {
  COMPLIANCE_AUDIT_DISCLAIMER,
  ComplianceAuditInputError,
  ComplianceModule,
  buildComplianceAuditReport,
} from '../src';
import type { AegisClient } from '../src/client';

describe('compliance audit reports', () => {
  it('builds a deterministic report with fail-closed status precedence', () => {
    const report = buildComplianceAuditReport({
      subject: '  portfolio-42  ',
      asOf: ' 2026-10-06T05:00:00Z ',
      evidence: [
        {
          id: 'kyc-state',
          source: 'protocol',
          description: 'On-chain KYC state',
          reference: ' ledger:42 ',
        },
        {
          id: 'asset-policy',
          source: 'operator',
          description: 'Approved asset policy',
        },
      ],
      checks: [
        {
          code: 'KYC',
          summary: 'KYC state is unavailable',
          status: 'unknown',
        },
        {
          code: 'ASSET',
          summary: 'Asset policy matches',
          status: 'pass',
          evidenceIds: ['asset-policy'],
        },
        {
          code: 'BLOCK',
          summary: 'Protocol state blocks the operation',
          status: 'fail',
          evidenceIds: ['kyc-state', 'asset-policy', 'kyc-state'],
        },
      ],
    });

    expect(report).toEqual({
      schemaVersion: 1,
      subject: 'portfolio-42',
      asOf: '2026-10-06T05:00:00Z',
      overallStatus: 'fail',
      summary: {
        total: 3,
        pass: 1,
        warn: 0,
        fail: 1,
        unknown: 1,
      },
      findings: [
        {
          code: 'ASSET',
          summary: 'Asset policy matches',
          status: 'pass',
          evidenceIds: ['asset-policy'],
        },
        {
          code: 'BLOCK',
          summary: 'Protocol state blocks the operation',
          status: 'fail',
          evidenceIds: ['asset-policy', 'kyc-state'],
        },
        {
          code: 'KYC',
          summary: 'KYC state is unavailable',
          status: 'unknown',
          evidenceIds: [],
        },
      ],
      evidence: [
        {
          id: 'asset-policy',
          source: 'operator',
          description: 'Approved asset policy',
          reference: undefined,
        },
        {
          id: 'kyc-state',
          source: 'protocol',
          description: 'On-chain KYC state',
          reference: 'ledger:42',
        },
      ],
      disclaimer: COMPLIANCE_AUDIT_DISCLAIMER,
    });
  });

  it('rejects unknown evidence references and evidenced statuses without evidence', () => {
    expect(() =>
      buildComplianceAuditReport({
        subject: 'portfolio-42',
        evidence: [],
        checks: [
          {
            code: 'KYC',
            summary: 'KYC state passes',
            status: 'pass',
            evidenceIds: ['missing'],
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining<Partial<ComplianceAuditInputError>>({
        code: 'UNKNOWN_EVIDENCE_REFERENCE',
      }),
    );

    expect(() =>
      buildComplianceAuditReport({
        subject: 'portfolio-42',
        evidence: [],
        checks: [
          {
            code: 'KYC',
            summary: 'KYC state passes',
            status: 'pass',
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining<Partial<ComplianceAuditInputError>>({
        code: 'EVIDENCE_REQUIRED',
      }),
    );
  });

  it('exposes the same pure builder through ComplianceModule', () => {
    const module = new ComplianceModule({} as AegisClient);
    const report = module.buildAuditReport({
      subject: 'portfolio-42',
      evidence: [],
      checks: [
        {
          code: 'MANUAL_REVIEW',
          summary: 'Operator review is pending',
          status: 'unknown',
        },
      ],
    });

    expect(report.overallStatus).toBe('unknown');
    expect(report.summary.unknown).toBe(1);
    expect(report.disclaimer).toBe(COMPLIANCE_AUDIT_DISCLAIMER);
  });
});
