import { workerCapacityRevision, workerCapacityValue } from '../../contracts/workerCapacity';
import type { RadnikProfilProjekcija } from '../../contracts/projections';
import type { AzurirajProfilKomanda } from '../../data/ports';
import { capabilityTerms } from '../../lib/capabilityTerms';

export type WorkerDraft = { ime: string; grad: string; biografija: string; vestine: string[]; alati: string[];
  vozila: string[]; capacity: string; capacityRevision: string | null; radius: string; dostupanOdmah: boolean; newSkill: string; newTool: string; newVehicle: string };
export function workerDraft(profile: RadnikProfilProjekcija | null): WorkerDraft {
  return profile ? { ime: profile.ime, grad: profile.grad, biografija: profile.biografija, vestine: [...profile.vestine],
    alati: [...profile.alati], vozila: [...profile.vozila], radius: String(profile.radijusKm), dostupanOdmah: profile.dostupanOdmah,
    capacity: profile.kapacitetTima === undefined ? '' : String(profile.kapacitetTima), capacityRevision: profile.capacityRevision ?? null,
    newSkill: '', newTool: '', newVehicle: '' }
    : { capacity: '', capacityRevision: null, ime: '', grad: '', biografija: '', vestine: [], alati: [], vozila: [], radius: '', dostupanOdmah: false, newSkill: '', newTool: '', newVehicle: '' };
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function workerCommand(draft: WorkerDraft, initial: WorkerDraft, activate: boolean): { command?: AzurirajProfilKomanda; expected?: AzurirajProfilKomanda; error?: string } {
  if ([draft.newSkill, draft.newTool, draft.newVehicle].some(value => value.trim())) return { error: 'Uneta stavka još nije dodata. Dodaj je u listu pre čuvanja.' };
  if (draft.grad !== initial.grad || draft.radius !== initial.radius || draft.dostupanOdmah !== initial.dostupanOdmah) {
    return { error: 'Mesto i radijus menjaj u području rada, a dostupnost u podešavanju dostupnosti.' };
  }
  const capacityChanged = draft.capacity !== initial.capacity;
  if ((capacityChanged || activate) && (!/^[0-9]{1,2}$/.test(draft.capacity) ||
      !workerCapacityValue(Number(draft.capacity)) || !workerCapacityRevision(initial.capacityRevision))) {
    return { error: 'Najpre sačuvaj i učitaj profil, zatim unesi kapacitet od 1 do 50 ljudi.' };
  }
  const lists = { vestine: capabilityTerms(draft.vestine), alati: capabilityTerms(draft.alati), vozila: capabilityTerms(draft.vozila) };
  if (Object.values(lists).some(value => value === null)) return { error: 'Svaka lista može imati do 50 stavki, do 500 znakova po stavci.' };
  const values = { ime: draft.ime.trim(), grad: draft.grad.trim(), biografija: draft.biografija.trim(),
    vestine: lists.vestine!, alati: lists.alati!, vozila: lists.vozila!, radijusKm: Number(draft.radius), dostupanOdmah: draft.dostupanOdmah };
  if (activate && (values.ime.length < 2 || values.grad.length < 2 || !values.vestine.length)) {
    return { error: 'Za aktivaciju unesi ime od najmanje 2 znaka i bar jednu veštinu; mesto potvrdi u području rada.' };
  }
  const before = { ...initial, radijusKm: Number(initial.radius) };
  const command: AzurirajProfilKomanda = { zavrsi: activate };
  // Only changed fields are written. A location edit elsewhere cannot be
  // silently overwritten by untouched inputs from this retained form.
  for (const key of Object.keys(values) as (keyof typeof values)[]) {
    if (!['grad', 'radijusKm', 'dostupanOdmah'].includes(key) && !equal(values[key], before[key])) Object.assign(command, { [key]: values[key] });
  }
  if (capacityChanged) Object.assign(command, { kapacitetTima: Number(draft.capacity), capacityRevision: initial.capacityRevision });
  // Activation confirms the visible profile, including unchanged fields. A
  // concurrent edit must not turn a different profile into a claimed success.
  return { command, expected: activate ? { ...values, kapacitetTima: Number(draft.capacity), zavrsi: true } : command };
}
/**
 * Quick picks (presentation only). A picture tile inserts its catalog label as the same free text a person could type
 * ("Kombi", "Transportna kolica"); nothing new is stored and matching stays the existing lower-cased exact match. Two
 * spellings of one term are the same term here: the folded form trims ASCII spaces (as `capabilityTerms` and btrim do)
 * and lower-cases in Serbian Latin.
 */
export const foldTerm = (term: string) => term.replace(/^ +| +$/g, '').toLocaleLowerCase('sr-Latn-RS');
/** Whether the list already holds this term, in any spelling of its case. */
export const hasTerm = (values: readonly string[], label: string) => values.some(value => foldTerm(value) === foldTerm(label));
/**
 * A tile's tap: removes every item that folds to the label (a typed "kombi" and a duplicate "Kombi" alike), or adds the
 * label when the list has room (50 items, the `capabilityTerms` cap). A full list is returned unchanged.
 */
export function toggleTerm(values: readonly string[], label: string): string[] {
  if (hasTerm(values, label)) return values.filter(value => foldTerm(value) !== foldTerm(label));
  return values.length < 50 ? [...values, label] : [...values];
}
export function workerReadbackMatches(profile: RadnikProfilProjekcija | null, command: AzurirajProfilKomanda, expectedId: string | null): boolean {
  if (!profile || (expectedId !== null && profile.id !== expectedId) || (command.zavrsi && profile.stanje !== 'ACTIVE')) return false;
  return (Object.keys(command) as (keyof AzurirajProfilKomanda)[]).every(key => key === 'zavrsi' || key === 'capacityRevision' ||
    (key !== 'licence' && equal(command[key], profile[key as keyof RadnikProfilProjekcija])));
}
