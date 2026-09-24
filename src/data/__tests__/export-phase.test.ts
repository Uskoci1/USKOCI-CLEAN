import type { DataExportRequestStatus, DataExportStatus } from '../../contracts/dataExport';
import { exportPhase, exportSteps } from '../../ui/privacy/ExportPresentation';

// Round 5 (owner step 11b): the export's three steps are drawn from one phase per request status, so the steps can no
// longer say a request is missing beside one that exists, draw a cancelled request as the active step, or draw a failure
// as a step still to come.
const NOW = Date.parse('2026-09-24T10:00:00Z');
const artifact = (expiresAt: string) => ({ artifactAvailable: true as const, artifactGeneration: '22222222-2222-4222-8222-222222222222',
  artifactExpiresAt: expiresAt, byteLength: 12_800, sha256: 'a'.repeat(64), md5: 'b'.repeat(32) });
const status = (state: DataExportRequestStatus | null, fulfillment: DataExportStatus['fulfillment'] = null): DataExportStatus => ({
  hasRequest: state !== null, downloadAvailable: !!fulfillment, fulfillment, serverFulfillmentRequired: true, externalDsrChannelReady: false,
  request: state ? { receiptId: '11111111-1111-4111-8111-111111111111', clientRequestId: 'k', status: state, requestedAt: '2026-09-24T09:00:00Z',
    updatedAt: '2026-09-24T09:00:00Z', cancelledAt: null, completedAt: null, failureCode: null } : null,
});
const states = (value: DataExportStatus) => exportSteps(exportPhase(value, NOW), value).map(step => step.state);

it('names no request as all steps to come', () => {
  expect(exportPhase(status(null), NOW)).toBe('NONE');
  expect(states(status(null))).toEqual(['pending', 'pending', 'pending']);
});
it('a request that waits for its preparation says the preparation has not started', () => {
  const steps = exportSteps(exportPhase(status('REQUESTED'), NOW), status('REQUESTED'));
  expect(steps.map(step => step.state)).toEqual(['done', 'current', 'pending']);
  expect(steps[1].copy).toBe('Priprema još nije pokrenuta.');
  expect(steps.map(step => step.copy)).not.toContain('Priprema počinje nakon tvog zahteva.');
});
it('a cancelled request is stopped, not the active step', () => {
  expect(exportPhase(status('CANCELLED'), NOW)).toBe('CANCELLED');
  expect(states(status('CANCELLED'))).toEqual(['stopped', 'pending', 'pending']);
  expect(exportSteps('CANCELLED', status('CANCELLED'))[0].copy).toBe('Zahtev je otkazan.');
});
it('a failed preparation stops at the second step', () => {
  expect(states(status('FAILED'))).toEqual(['done', 'stopped', 'pending']);
});
it('READY with a copy whose availability has run out is EXPIRED, before the status says so', () => {
  expect(exportPhase(status('READY', artifact('2026-09-24T09:59:59Z')), NOW)).toBe('EXPIRED');
  expect(states(status('READY', artifact('2026-09-24T09:59:59Z')))).toEqual(['done', 'done', 'stopped']);
  expect(exportPhase(status('EXPIRED'), NOW)).toBe('EXPIRED');
});
// Round 5 review: this pinned the old step ("pending", "Dostupno kada stvarna kopija bude spremna."), which drew a copy
// that cannot be saved as a step still to come while the footer offered a new copy. It is stopped now, in existing words.
it('READY without a verified copy is not available: the download step is stopped, never a step still to come', () => {
  expect(exportPhase(status('READY'), NOW)).toBe('READY_UNAVAILABLE');
  expect(exportSteps('READY_UNAVAILABLE', status('READY'))[2]).toMatchObject({ state: 'stopped', copy: 'Ova kopija se ne može sačuvati.' });
  // A copy with an unreadable expiry is never offered.
  expect(exportPhase(status('READY', artifact('not a time')), NOW)).toBe('READY_UNAVAILABLE');
});
it('READY with a verified copy in time is the one saveable phase, with its expiry and size on the step', () => {
  const value = status('READY', artifact('2026-09-25T10:00:00Z'));
  expect(exportPhase(value, NOW)).toBe('READY_AVAILABLE');
  const last = exportSteps('READY_AVAILABLE', value)[2];
  expect(last.state).toBe('current');
  expect(last.meta?.[0]).toMatch(/^Dostupno do .+\.$/); expect(last.meta?.[1]).toBe('Datoteka JSON · 13 KB');
});
it('maps every request status to exactly one phase', () => {
  const all: DataExportRequestStatus[] = ['REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED', 'EXPIRED'];
  expect(all.map(state => exportPhase(status(state), NOW))).toEqual(['REQUESTED', 'PROCESSING', 'READY_UNAVAILABLE', 'FAILED', 'CANCELLED', 'EXPIRED']);
});
