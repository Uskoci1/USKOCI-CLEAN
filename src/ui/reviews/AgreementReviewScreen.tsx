import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../contracts/projections';
import { readableTitle } from '../../data/needDetailPresentation';
import { reviewsClientService, type ReviewCommand, type ReviewTag } from '../../data/reviewsClientService';
import { failure } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { AgreementReviewPresentation, type ReviewView } from './AgreementReviewPresentation';

export { AgreementReviewPresentation, type ReviewPerson, type ReviewView } from './AgreementReviewPresentation';

export function backFromReview() { if (router.canGoBack()) router.back(); else router.replace('/dogovori'); }
/** The rating opened from a Dogovor: Back returns there, and with no history (a cold link) it opens that Dogovor, as it says. */
export function backFromReviewToAgreement(agreementId: string) {
  if (router.canGoBack()) router.back(); else router.replace({ pathname: '/dogovor/[id]', params: { id: agreementId } });
}
/** The rating opened from Početna: Back returns there, and with no history it lands there too. */
export function backFromReviewToHome() { if (router.canGoBack()) router.back(); else router.replace('/'); }

/**
 * One rating, up to N tags, one save. The saved receipt is final and shown as such.
 *
 * One calm screen (round 6, unit `prijava`, 2026-09-24): the person being rated first (their picture, name, what they are
 * to me and the task), five large stars, the optional tags, and ONE green save pinned at the foot. The stars are the
 * screen's one orange accent. The person comes from a second read of the Dogovor; it never blocks or delays the rating,
 * and when it fails or does not match the person the server names, no person is drawn (nothing is invented).
 */
export function AgreementReviewScreen({ agreementId, accountId, accountRevision, backLabel = 'Nazad na Dogovor', onBack = backFromReview,
  readAgreement, photo, roleOf }: {
  agreementId: string; accountId: string; accountRevision: number;
  /** What the way back is called: the screen the rating was opened from ("Nazad na Početnu" from Početna's strip). */
  backLabel?: string;
  /** The way back, for the top bar's arrow and for the button that names it. */
  onBack?: () => void;
  /** Reads the Dogovor, only to show whom the rating is about. */
  readAgreement?: () => Promise<DogovorProjekcija | null>;
  /** The person's photo at 56, drawn by the route; `fallback` (their letters) when there is none. */
  photo?: (profileId: string, fallback: ReactNode) => ReactNode;
  /** What the person is to me, in the Dogovor's own words; the route hands it in so this screen loads no media code. */
  roleOf?: (person: UcesnikProjekcija) => string;
}) {
  const read = useCallback(() => reviewsClientService.context(agreementId, { accountId, accountRevision }),
    [agreementId, accountId, accountRevision]);
  const workspace = useOwnedEditor(read);
  const [rating, setRating] = useState(0), [tags, setTags] = useState<ReviewTag[]>([]);
  const [attempt, setAttempt] = useState<ReviewCommand | null>(null);
  const attemptRef = useRef<ReviewCommand | null>(null);
  const activeRef = useRef(true);
  const [foreground, setForeground] = useState(true), [resumeRequired, setResumeRequired] = useState(false);
  // A mount effect, not a focus effect. On 2026-09-23 every star and tag on this screen was dead on two phones
  // and the emulator while the back arrow in the same top bar worked; the one difference was a guard that
  // compared a focus token minted inside `useFocusEffect` with the token the render had captured, and on the
  // device the two never met: the emulator probe of 2026-09-23 (build 4e864a08) showed the focus effect ran once with
  // AppState active, so the token was minted after the render that drew the stars, and nothing re-rendered after it. Which screen is current is
  // already owned by `useOwnedEditor` (its data is null while this screen is blurred, so nothing is editable
  // then, and a stale save is refused by its scope); the app's foreground state belongs to a mount effect.
  useEffect(() => {
    activeRef.current = true;
    const subscription = AppState.addEventListener('change', state => {
      activeRef.current = state === 'active'; setForeground(activeRef.current); setResumeRequired(true);
    });
    return () => { subscription.remove(); activeRef.current = false; };
  }, []);
  useEffect(() => {
    if (!foreground || !resumeRequired || workspace.busy) return;
    let current = true;
    void workspace.refresh().then(() => { if (current && activeRef.current) setResumeRequired(false); });
    return () => { current = false; };
  }, [foreground, resumeRequired, workspace.busy, workspace.refresh]);
  const context = workspace.data, receipt = context?.review;
  // Whom the rating is about: the Dogovor's own participant with the account the server named, and never me.
  const target = context?.targetAccountId ?? null;
  const [person, setPerson] = useState<{ who: UcesnikProjekcija; task: string } | null>(null);
  const personRequest = useRef(0);
  useEffect(() => {
    if (!readAgreement || !target) return;
    const request = ++personRequest.current;
    readAgreement().then(agreement => {
      if (request !== personRequest.current) return;
      const who = agreement?.ucesnici.find(p => p.id === target && !p.viSte);
      setPerson(who && agreement ? { who, task: readableTitle(agreement.naslov) } : null);
    }).catch(() => { if (request === personRequest.current) setPerson(null); });
    return () => { personRequest.current++; };
  }, [readAgreement, target]);
  // "Ponovi istu ocenu" only once a save has come back unconfirmed; the first save keeps its own words while it runs.
  const [settled, setSettled] = useState(false);
  useEffect(() => { if (attempt && !workspace.busy) setSettled(true); }, [attempt, workspace.busy]);
  const enabled = foreground && !resumeRequired && !workspace.loading && !workspace.busy && !workspace.error && !workspace.uncertain;
  const current = () => activeRef.current;
  const editable = enabled && context?.eligible === true && !attempt;
  const submit = () => {
    if (!enabled || !current() || !context?.eligible || rating < 1) return;
    void workspace.save(async () => {
      const command = attemptRef.current ?? { agreementId, targetAccountId: context.targetAccountId,
        rating, tags: [...tags].sort(), clientRequestId: noviUuidZahtevId() };
      attemptRef.current = command; setAttempt(command);
      const result = await reviewsClientService.submit(command, { accountId, accountRevision });
      if (!result.ok) return result;
      const checked = await read();
      if (!checked.ok) return checked;
      if (checked.podatak.review?.reviewId !== result.podatak.reviewId) {
        return failure('REVIEW_READBACK_REQUIRED', 'Potvrda ocene nije učitana. Proveri sačuvanu ocenu.');
      }
      return checked;
    });
  };
  const loading = workspace.loading || !foreground || resumeRequired;
  const retry = { label: attempt ? 'Proveri sačuvanu ocenu' : 'Ponovo učitaj ocenu', disabled: workspace.busy || !foreground,
    onPress: () => { if (current()) void workspace.refresh(); } };
  const view: ReviewView = loading ? { kind: 'loading' }
    : !context && workspace.error ? { kind: 'error', message: workspace.error }
    : receipt ? { kind: 'saved', rating: receipt.rating, tags: receipt.tags, fresh: workspace.saved }
    : context?.eligible ? { kind: 'eligible', catalog: context.tagCatalog, rating, tags, editable, attempt: !!attempt,
      onRate: value => { if (editable && current() && !attemptRef.current) setRating(value); },
      onToggleTag: tag => { if (editable && current() && !attemptRef.current) setTags(values => values.includes(tag)
        ? values.filter(value => value !== tag) : values.length < context.tagCatalog.maxTags ? [...values, tag] : values); },
      save: { label: settled ? 'Ponovi istu ocenu' : 'Sačuvaj ocenu', loading: workspace.busy, disabled: !enabled || rating < 1,
        reason: enabled && rating < 1 ? 'Izaberi ocenu od 1 do 5 pre slanja.' : null, onPress: submit } }
    : context ? { kind: 'unavailable' } : { kind: 'none' };
  return <AgreementReviewPresentation backLabel={backLabel} onBack={onBack} view={view} retry={retry}
    notice={!loading && workspace.error && context ? workspace.error : null}
    person={person ? { name: person.who.ime, initials: person.who.inicijali, profileId: person.who.profilId, role: roleOf?.(person.who) ?? '', task: person.task } : null}
    photo={photo} />;
}
