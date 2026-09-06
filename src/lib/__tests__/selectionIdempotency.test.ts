import { SelectionRequestRegistry, type SelectionIntent } from '../selectionIdempotency';

const base: SelectionIntent = {
  potrebaId: 'need-1',
  potrebaRevizija: 3,
  prijavaId: 'response-1',
  prijavaVerzija: 4,
  prijavaHash: 'a'.repeat(64),
  mesta: 2,
};

describe('P0D-02 SelectionRequestRegistry', () => {
  it('reuses one request ID for an exact ambiguous retry', () => {
    let sequence = 0;
    const registry = new SelectionRequestRegistry(() => `selection-${++sequence}`);

    expect(registry.getOrCreate(base)).toBe('selection-1');
    expect(registry.getOrCreate({ ...base })).toBe('selection-1');
    expect(sequence).toBe(1);
  });

  it.each([
    ['need', { potrebaId: 'need-2' }],
    ['need revision', { potrebaRevizija: 4 }],
    ['response', { prijavaId: 'response-2' }],
    ['response version', { prijavaVerzija: 5 }],
    ['content hash', { prijavaHash: 'b'.repeat(64) }],
    ['covered slots', { mesta: 1 }],
  ])('uses a new request ID when %s changes', (_label, patch) => {
    let sequence = 0;
    const registry = new SelectionRequestRegistry(() => `selection-${++sequence}`);

    expect(registry.getOrCreate(base)).toBe('selection-1');
    expect(registry.getOrCreate({ ...base, ...patch })).toBe('selection-2');
  });

  it('creates a new logical command only after the successful intent is cleared', () => {
    let sequence = 0;
    const registry = new SelectionRequestRegistry(() => `selection-${++sequence}`);

    expect(registry.getOrCreate(base)).toBe('selection-1');
    registry.clear(base);
    expect(registry.getOrCreate(base)).toBe('selection-2');
  });
});
