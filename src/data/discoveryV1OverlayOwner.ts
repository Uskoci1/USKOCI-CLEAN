import type { JavniProfilProjekcija, NeedUrgencyProjection, PrilikaProjekcija } from '../contracts/projections';
import type { Izvor } from './ports';
import type { DiscoveryV1Item } from './discoveryV1Contract';
import { discoveryV1EnrichmentTargets, discoveryV1Opportunities } from './discoveryV1MarketplaceAdapter';
import { publicProfileClientService } from './publicProfileClientService';
import { readNeedUrgencies } from './needUrgencyClientService';
import type { TaskRelation, TaskRelationIndex } from './taskRelation';

export const DISCOVERY_V1_OVERLAY_LIMIT = 100;
export const DISCOVERY_V1_PROFILE_CONCURRENCY = 4;

export type DiscoveryV1OverlayLoaders = {
  relations: (needIds: readonly string[], signal: AbortSignal) => Promise<TaskRelationIndex>;
  profile: (profileId: string, signal: AbortSignal) => Promise<JavniProfilProjekcija | null>;
  urgencies: (rows: readonly { id: string; urgent: boolean }[], signal: AbortSignal) => Promise<Map<string, NeedUrgencyProjection>>;
};
export type DiscoveryV1OverlaySnapshot = {
  active: boolean; generation: number; sliceKey: string | null; loading: boolean;
  relations: TaskRelationIndex | null; profiles: ReadonlyMap<string, JavniProfilProjekcija>;
  urgency: ReadonlyMap<string, NeedUrgencyProjection>; missingProfiles: ReadonlySet<string>;
  errors: { relations: boolean; profiles: boolean; urgencies: boolean };
};
export type DiscoveryV1OverlayLoadResult = { kind: 'applied'; snapshot: DiscoveryV1OverlaySnapshot } | { kind: 'stale' };

const unknownRelation: TaskRelation = { kind: 'UNKNOWN' };
const formatRating = (profile: JavniProfilProjekcija | undefined): string | null => {
  if (!profile?.poverenje.ocenaDostupna || profile.poverenje.ocenaProsek === null) return null;
  return profile.poverenje.ocenaProsek.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};
const reviewCount = (profile: JavniProfilProjekcija | undefined): number | null => {
  if (!profile?.poverenje.recenzijeDostupne) return null;
  const value = profile.poverenje.brojRecenzija;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
};

export function discoveryV1OverlaySliceKey(items: readonly DiscoveryV1Item[]): string {
  if (items.length > DISCOVERY_V1_OVERLAY_LIMIT) throw new Error('DISCOVERY_V1_OVERLAY_BOUND');
  const ids = new Set<string>();
  return items.map(item => {
    if (ids.has(item.id)) throw new Error('DISCOVERY_V1_OVERLAY_DUPLICATE');
    ids.add(item.id);
    return [item.id, item.revision, item.requesterProfileId, item.urgent ? '1' : '0'].join(':');
  }).join('|');
}

export function discoveryV1ApplyOverlays(items: readonly DiscoveryV1Item[], overlay: DiscoveryV1OverlaySnapshot)
  : (PrilikaProjekcija & { revision: number })[] {
  const key = discoveryV1OverlaySliceKey(items), base = discoveryV1Opportunities(items);
  if (overlay.sliceKey !== key || overlay.loading) return base;
  return base.map((item, index) => {
    const source = items[index], profile = overlay.profiles.get(source.requesterProfileId), urgency = overlay.urgency.get(source.id);
    return { ...item, ...(urgency ? { urgency } : {}), narucilacIme: profile?.ime ?? '',
      narucilacOcena: formatRating(profile), narucilacBrojOcena: reviewCount(profile), narucilacAvatarId: null };
  });
}
export function discoveryV1OverlayRelation(overlay: DiscoveryV1OverlaySnapshot, needId: string): TaskRelation {
  return overlay.relations?.relation(needId) ?? unknownRelation;
}

export function createDiscoveryV1ExistingOverlayLoaders(source: Pick<Izvor, 'odnosiPremaZadacima'>): DiscoveryV1OverlayLoaders {
  return {
    relations: (ids, signal) => source.odnosiPremaZadacima(ids, { signal }),
    profile: (id, signal) => publicProfileClientService.javniProfil(id, signal),
    urgencies: (rows, signal) => readNeedUrgencies(rows, signal),
  };
}

export function createDiscoveryV1OverlayOwner(loaders: DiscoveryV1OverlayLoaders, isCurrent: () => boolean = () => true) {
  let active = true, generation = 0, controller: AbortController | null = null;
  let state: DiscoveryV1OverlaySnapshot = { active: true, generation: 0, sliceKey: null, loading: false, relations: null,
    profiles: new Map(), urgency: new Map(), missingProfiles: new Set(), errors: { relations: false, profiles: false, urgencies: false } };
  const snapshot = (): DiscoveryV1OverlaySnapshot => ({ ...state, profiles: new Map(state.profiles), urgency: new Map(state.urgency),
    missingProfiles: new Set(state.missingProfiles), errors: { ...state.errors } });
  const current = (g: number) => active && generation === g && isCurrent();

  async function load(items: readonly DiscoveryV1Item[]): Promise<DiscoveryV1OverlayLoadResult> {
    if (!active) return { kind: 'stale' };
    const sliceKey = discoveryV1OverlaySliceKey(items);
    const { needIds, profileIds } = discoveryV1EnrichmentTargets(items, DISCOVERY_V1_OVERLAY_LIMIT);
    controller?.abort();
    const own = new AbortController(); controller = own; const g = ++generation;
    state = { active: true, generation: g, sliceKey, loading: true, relations: null, profiles: new Map(), urgency: new Map(),
      missingProfiles: new Set(), errors: { relations: false, profiles: false, urgencies: false } };

    const relationTask = loaders.relations(needIds, own.signal).then(value => ({ ok: true as const, value }), () => ({ ok: false as const }));
    const urgencyRows = items.map(item => ({ id: item.id, urgent: item.urgent }));
    const urgencyTask = loaders.urgencies(urgencyRows, own.signal).then(value => ({ ok: true as const, value }), () => ({ ok: false as const }));
    const profiles = new Map<string, JavniProfilProjekcija>(), missingProfiles = new Set<string>();
    let profileCursor = 0, profileFailed = false;
    const worker = async () => {
      while (!own.signal.aborted && profileCursor < profileIds.length) {
        const id = profileIds[profileCursor++];
        try {
          const value = await loaders.profile(id, own.signal);
          if (own.signal.aborted) return;
          if (value === null) { missingProfiles.add(id); continue; }
          if (value.profilId !== id || value.uloga !== 'narucilac') { profileFailed = true; missingProfiles.add(id); continue; }
          profiles.set(id, value);
        } catch { if (!own.signal.aborted) { profileFailed = true; missingProfiles.add(id); } }
      }
    };
    await Promise.all([relationTask, urgencyTask,
      Promise.all(Array.from({ length: Math.min(DISCOVERY_V1_PROFILE_CONCURRENCY, profileIds.length) }, worker))]);
    const relations = await relationTask, urgencies = await urgencyTask;
    if (!current(g)) { own.abort(); return { kind: 'stale' }; }

    if (urgencies.ok) {
      for (const [id, value] of urgencies.value) {
        const valid = needIds.includes(id) && (value.level === 'NORMAL' ? value.expiresAt === null
          : value.level === 'HITNO' && typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt)));
        if (!valid) { own.abort(); throw new Error('DISCOVERY_V1_OVERLAY_URGENCY_INVALID'); }
      }
    }
    state = { active: true, generation: g, sliceKey, loading: false, relations: relations.ok ? relations.value : null,
      profiles: new Map(profiles), urgency: urgencies.ok ? new Map(urgencies.value) : new Map(), missingProfiles: new Set(missingProfiles),
      errors: { relations: !relations.ok, profiles: profileFailed, urgencies: !urgencies.ok } };
    if (controller === own) controller = null;
    own.abort();
    return { kind: 'applied', snapshot: snapshot() };
  }

  const retire = () => {
    if (!active) return;
    active = false; generation++; controller?.abort(); controller = null;
    state = { active: false, generation, sliceKey: null, loading: false, relations: null, profiles: new Map(), urgency: new Map(),
      missingProfiles: new Set(), errors: { relations: false, profiles: false, urgencies: false } };
  };
  return { load, snapshot, retire };
}
