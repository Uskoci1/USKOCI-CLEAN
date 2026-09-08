import Constants from 'expo-constants';

export interface BuildIdentity {
  version: string | null;
  sourceCommit: string | null;
  sourceDirty: boolean | null;
  backendTarget: 'canonical' | 'local' | 'other' | 'unconfigured';
}

/** Display-only config projection, never an Auth, policy or activation authority. */
export function readBuildIdentity(raw: unknown = Constants.expoConfig?.extra?.uskociBuild): BuildIdentity {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (value.schemaVersion !== 1) return { version: null, sourceCommit: null, sourceDirty: null, backendTarget: 'unconfigured' };
  return {
    version: typeof value.version === 'string' && value.version.length <= 64 && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value.version) ? value.version : null,
    sourceCommit: typeof value.sourceCommit === 'string' && /^[0-9a-f]{40}$/.test(value.sourceCommit) ? value.sourceCommit : null,
    sourceDirty: typeof value.sourceDirty === 'boolean' ? value.sourceDirty : null,
    backendTarget: value.backendTarget === 'canonical' || value.backendTarget === 'local' || value.backendTarget === 'other'
      ? value.backendTarget : 'unconfigured',
  };
}
