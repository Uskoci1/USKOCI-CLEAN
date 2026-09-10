import { View } from 'react-native';
import type { PublicationEvaluation, PublicationNotReadyCode } from '../contracts/publication';
import { space } from '../theme/tokens';
import { Button, Card } from './Button';
import { T } from './Text';

const NOT_READY: Record<PublicationNotReadyCode, string> = {
  POLICY_NOT_READY: 'Provera za objavu još nije dostupna. Nacrt je sačuvan.',
  POLICY_CONTENT_NOT_READY: 'Provera za objavu još nije dostupna. Nacrt je sačuvan.',
  LOCATION_INCOMPLETE: 'Potvrdite sva potrebna mesta izvršenja pre objave.',
  COUNTRY_NOT_READY: 'Objava u izabranoj državi trenutno nije dostupna.',
  PUBLIC_MEDIA_NOT_READY: 'Fotografije još nisu spremne za objavu.',
  EVALUATOR_UNAVAILABLE: 'Provera trenutno nije dostupna. Pokušajte ponovo.',
  EVALUATOR_INVALID_RESPONSE: 'Rezultat provere nije potvrđen. Pokušajte ponovo.',
  RATE_LIMITED: 'Sačekajte malo pre nove provere.',
  NEED_CHANGED: 'Zadatak je promenjen. Učitajte trenutno stanje pre nove provere.',
};
type Props = {
  evaluation: PublicationEvaluation | null; busy: boolean; retrying: boolean;
  onEvaluate: () => void; onPublish: () => void; onRetry: () => void; onEdit: () => void;
};
/** Presentation only. The route owns the reviewed snapshot, confirmation and receipt. */
export function NeedPublicationPanel({ evaluation, busy, retrying, onEvaluate, onPublish, onRetry, onEdit }: Props) {
  const decision = evaluation?.kind === 'DECISION' ? evaluation.decision : null;
  const allowed = decision?.authoritative === true && decision.outcome === 'ALLOW' && decision.publishable;
  const copy = evaluation?.kind === 'NOT_READY' ? NOT_READY[evaluation.code]
    : decision?.outcome === 'CLARIFY' ? 'Za objavu su potrebna dodatna pojašnjenja. Pregledajte i izmenite nacrt.'
      : decision?.outcome === 'REVIEW' ? 'Provera nije odobrila objavu. Zadatak ostaje sačuvan kao nacrt.'
        : decision?.outcome === 'BLOCK' ? 'Ovaj Zadatak nije odobren za objavu. Nacrt ostaje sačuvan.'
          : allowed ? 'Provera je odobrila ovu verziju Zadatka. Objavu potvrđujete zasebno.'
            : 'Nacrt je privatan. Proverite da li je spreman za objavu.';
  return <Card raised><View style={{ padding: space.base, gap: space.md }}>
    <T variant="heading">Objava Zadatka</T>
    <T accessibilityLiveRegion="polite" tone="muted">{copy}</T>
    {retrying ? <>
      <T>Prethodna objava nije potvrđena. Provereno je trenutno stanje; možete ponoviti isti zahtev.</T>
      <Button label="Ponovi isti zahtev za objavu" disabled={busy} onPress={onRetry} />
    </> : <>
      <Button label={busy ? 'Radnja je u toku…' : evaluation ? 'Ponovi proveru za objavu' : 'Proveri za objavu'}
        kind={allowed ? 'secondary' : 'primary'} disabled={busy} onPress={onEvaluate} />
      {allowed ? <>
        <T variant="meta">Dodatni rok za prijave nije izabran. Objavljujete Zadatak bez dodatnog roka za prijave.</T>
        <Button label="Objavi Zadatak" disabled={busy} onPress={onPublish} />
      </> : null}
    </>}
    <Button label="Izmeni nacrt" kind="quiet" disabled={busy || retrying} onPress={onEdit} />
    <T variant="meta" tone="muted">Tačna lokacija i privatne napomene ostaju privatni.</T>
  </View></Card>;
}
