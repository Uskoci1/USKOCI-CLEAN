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
  if ([draft.newSkill, draft.newTool, draft.newVehicle].some(value => value.trim())) return { error: 'Uneta stavka još nije dodata. Dodajte je u listu pre čuvanja.' };
  if (draft.grad !== initial.grad || draft.radius !== initial.radius || draft.dostupanOdmah !== initial.dostupanOdmah) {
    return { error: 'Mesto i radijus menjajte u području rada, a dostupnost u podešavanju dostupnosti.' };
  }
  const capacityChanged = draft.capacity !== initial.capacity;
  if ((capacityChanged || activate) && (!/^[0-9]{1,2}$/.test(draft.capacity) ||
      !workerCapacityValue(Number(draft.capacity)) || !workerCapacityRevision(initial.capacityRevision))) {
    return { error: 'Najpre sačuvajte i učitajte profil, zatim unesite kapacitet od 1 do 50 ljudi.' };
  }
  const lists = { vestine: capabilityTerms(draft.vestine), alati: capabilityTerms(draft.alati), vozila: capabilityTerms(draft.vozila) };
  if (Object.values(lists).some(value => value === null)) return { error: 'Svaka lista može imati do 50 stavki, do 500 znakova po stavci.' };
  const values = { ime: draft.ime.trim(), grad: draft.grad.trim(), biografija: draft.biografija.trim(),
    vestine: lists.vestine!, alati: lists.alati!, vozila: lists.vozila!, radijusKm: Number(draft.radius), dostupanOdmah: draft.dostupanOdmah };
  if (activate && (!values.ime || !values.grad || !values.vestine.length)) return { error: 'Za aktivaciju unesite ime i bar jednu veštinu; mesto potvrdite u području rada.' };
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
export function workerReadbackMatches(profile: RadnikProfilProjekcija | null, command: AzurirajProfilKomanda, expectedId: string | null): boolean {
  if (!profile || (expectedId !== null && profile.id !== expectedId) || (command.zavrsi && profile.stanje !== 'ACTIVE')) return false;
  return (Object.keys(command) as (keyof AzurirajProfilKomanda)[]).every(key => key === 'zavrsi' || key === 'capacityRevision' ||
    (key !== 'licence' && equal(command[key], profile[key as keyof RadnikProfilProjekcija])));
}
