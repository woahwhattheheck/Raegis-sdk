import {
  isComplianceStatus,
  mapComplianceStatusTransition,
} from '../src/compliance-transition';

describe('compliance status transitions', () => {
  it('maps pending to approved as an eligibility grant', () => {
    expect(mapComplianceStatusTransition('pending', 'approved')).toMatchObject({
      changed: true,
      wasEligible: false,
      isEligible: true,
      eligibilityChanged: true,
      code: 'ELIGIBILITY_GRANTED',
      action: 'allow',
      requiresRefresh: false,
    });
  });

  it('maps approved to revoked as lost eligibility', () => {
    expect(mapComplianceStatusTransition('approved', 'revoked')).toMatchObject({
      changed: true,
      wasEligible: true,
      isEligible: false,
      eligibilityChanged: true,
      code: 'ELIGIBILITY_LOST',
      action: 'deny',
    });
  });

  it('keeps blocked-to-revoked as a restriction change without inventing eligibility', () => {
    expect(mapComplianceStatusTransition('blocked', 'revoked')).toMatchObject({
      eligibilityChanged: false,
      code: 'RESTRICTION_CHANGED',
      action: 'deny',
    });
  });

  it('requires refresh when a previously readable status becomes unavailable', () => {
    expect(mapComplianceStatusTransition('approved', 'unavailable')).toMatchObject({
      code: 'STATUS_UNAVAILABLE',
      action: 'refresh',
      requiresRefresh: true,
      isEligible: false,
    });
  });

  it('marks a status recovered after availability returns', () => {
    expect(mapComplianceStatusTransition('unavailable', 'blocked')).toMatchObject({
      code: 'STATUS_RECOVERED',
      action: 'deny',
      requiresRefresh: false,
    });
  });

  it('distinguishes unknown resolution from a normal state change', () => {
    expect(mapComplianceStatusTransition('unknown', 'pending')).toMatchObject({
      code: 'STATUS_RESOLVED',
      action: 'deny',
    });
  });

  it('returns a stable no-change result', () => {
    expect(mapComplianceStatusTransition('pending', 'pending')).toMatchObject({
      changed: false,
      eligibilityChanged: false,
      code: 'NO_CHANGE',
      action: 'deny',
    });
  });

  it('guards runtime values without treating arbitrary strings as valid', () => {
    expect(isComplianceStatus('revoked')).toBe(true);
    expect(isComplianceStatus('legally-approved')).toBe(false);
    expect(isComplianceStatus(null)).toBe(false);
  });
});
