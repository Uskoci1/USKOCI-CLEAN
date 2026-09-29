import { discoveryV1ProductionReaderBuilt, selectDiscoveryReader } from '../discoveryV1ReaderGate';

describe('production reader build flag', () => {
  it('is closed unless the exact compile-time value is present', () => {
    for (const value of [undefined, null, '', '0', 'true', 'yes', 1, ' 1', '1 ']) {
      expect(discoveryV1ProductionReaderBuilt(value)).toBe(false);
    }
    expect(discoveryV1ProductionReaderBuilt('1')).toBe(true);
  });
});

describe('Zadaci reader selection', () => {
  const base = { publicationHandoff: false, proofParam: undefined, proofFlag: undefined, androidPackage: 'rs.uskoci' };

  it('keeps the legacy readers in a build without the flag, whatever the URL says', () => {
    expect(selectDiscoveryReader({ ...base, productionFlag: undefined })).toBe('LEGACY');
    expect(selectDiscoveryReader({ ...base, productionFlag: '0', proofParam: '1' })).toBe('LEGACY');
    expect(selectDiscoveryReader({ ...base, productionFlag: undefined, proofParam: '1', androidPackage: 'rs.uskoci.dev' })).toBe('LEGACY');
  });

  it('mounts P6 in a flagged build with no proof parameter, no proof flag and any package', () => {
    expect(selectDiscoveryReader({ ...base, productionFlag: '1' })).toBe('P6');
    expect(selectDiscoveryReader({ ...base, productionFlag: '1', androidPackage: 'rs.uskoci.dev' })).toBe('P6');
    expect(selectDiscoveryReader({ ...base, productionFlag: '1', proofParam: '0' })).toBe('P6');
  });

  it('leaves an authentic publication handoff on its separately proved landing reader', () => {
    expect(selectDiscoveryReader({ ...base, productionFlag: '1', publicationHandoff: true })).toBe('LEGACY');
    expect(selectDiscoveryReader({ ...base, productionFlag: undefined, publicationHandoff: true, proofParam: '1', proofFlag: '1', androidPackage: 'rs.uskoci.dev' })).toBe('LEGACY');
  });

  it('keeps the native proof gate fail-closed and unable to remove a production reader', () => {
    expect(selectDiscoveryReader({ ...base, productionFlag: undefined, proofParam: '1', proofFlag: '1', androidPackage: 'rs.uskoci.dev' })).toBe('P6');
    expect(selectDiscoveryReader({ ...base, productionFlag: undefined, proofParam: '1', proofFlag: '1', androidPackage: 'rs.uskoci' })).toBe('LEGACY');
    expect(selectDiscoveryReader({ ...base, productionFlag: undefined, proofParam: '1', proofFlag: undefined, androidPackage: 'rs.uskoci.dev' })).toBe('LEGACY');
    expect(selectDiscoveryReader({ ...base, productionFlag: '1', proofParam: '1', proofFlag: '0', androidPackage: 'rs.uskoci.dev' })).toBe('P6');
  });
});
