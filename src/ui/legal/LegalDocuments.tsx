import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, View } from 'react-native';
import type { LegalBundleStatus, LegalDocument, LegalDocumentKind } from '../../contracts/legal';
import { legalClientService } from '../../data/legalClientService';
import { sesijaSada } from '../../store/sesija';
import { SettingsAction, SettingsGroup, SettingsIntro, SettingsPanel, SettingsRow, SettingsScreen, SettingsText as T } from '../settings/SettingsPresentation';
import { sys } from '../system/tokens';
import { boundedLegalRead, legalHttpsUrl, reviewedDocuments } from './legalReview';
import { FactArt } from '../system/FactArt';

const legalTitle = (kind: LegalDocumentKind) => kind === 'TERMS' ? 'Uslovi korišćenja' : 'Politika privatnosti';
export function LegalDocumentRows({ bundle, onOpen, disabled = false }: {
  bundle: LegalBundleStatus | null; onOpen: (document: LegalDocument) => void; disabled?: boolean;
}) {
  const documents = reviewedDocuments(bundle);
  return documents ? <SettingsGroup title="Objavljeni dokumenti">{documents.map((document, index) =>
    <SettingsRow key={document.kind} label={legalTitle(document.kind)} detail={`Verzija ${document.version} · Otvara se u pregledaču`}
      icon={<FactArt kind={document.kind === 'TERMS' ? 'document' : 'shield'} size={26} />}
      onPress={() => onOpen(document)} disabled={disabled} last={index === 1} />)}</SettingsGroup>
    : <SettingsPanel soft><T>{bundle ? 'Uslovi korišćenja i Politika privatnosti još nisu objavljeni.' : 'Dokumenti trenutno nisu dostupni.'}</T></SettingsPanel>;
}

/** Public read-only sheet. Closing it leaves every Auth field and checkbox in place. */
export function PublicLegalModal({ kind, onClose }: { kind: LegalDocumentKind | null; onClose: () => void }) {
  return kind ? <Modal visible onRequestClose={onClose} animationType="none" presentationStyle="fullScreen">
    <PublicLegalContents kind={kind} onClose={onClose} />
  </Modal> : null;
}
function PublicLegalContents({ kind, onClose }: { kind: LegalDocumentKind; onClose: () => void }) {
  const [bundle, setBundle] = useState<LegalBundleStatus | null>(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const scope = useRef<object | null>(null);
  const owner = useRef(sesijaSada()); const opening = useRef(false);
  const current = (token: object | null) => !!token && scope.current === token &&
    sesijaSada().user?.id === owner.current.user?.id && sesijaSada().accountRevision === owner.current.accountRevision;
  const read = useCallback(async () => {
    const token = {}; scope.current = token; setLoading(true); setError(null); setBundle(null);
    try { const result = await boundedLegalRead(() => legalClientService.readBundle());
      if (!current(token)) return;
      if (result.ok) setBundle(result.podatak); else setError(result.poruka);
    } catch { if (current(token)) setError('Dokumenti trenutno nisu dostupni. Pokušaj ponovo.'); }
    finally { if (current(token)) setLoading(false); }
  }, []);
  useEffect(() => { void read(); return () => { scope.current = null; }; }, [read]);
  const open = async (document: LegalDocument) => {
    const token = scope.current, url = legalHttpsUrl(document.url);
    if (!current(token) || !url || opening.current) return;
    opening.current = true; setError(null);
    try { await Linking.openURL(url); }
    catch { if (current(token)) setError('Dokument nije otvoren. Pokušaj ponovo.'); }
    finally { opening.current = false; }
  };
  return <SettingsScreen title={legalTitle(kind)} onBack={onClose}>
    <SettingsIntro>Otvori objavljene dokumente. Posle čitanja možeš nastaviti svoj formular.</SettingsIntro>
    {loading ? <ActivityIndicator accessibilityLabel="Učitavanje pravnih dokumenata" color={sys.color.green} /> : <LegalDocumentRows bundle={bundle} onOpen={doc => { void open(doc); }} />}
    {error ? <View accessibilityLiveRegion="polite"><T accessibilityRole="alert">{error}</T></View> : null}
    {!loading ? <SettingsAction label="Osveži dokumente" kind="quiet" onPress={() => { void read(); }} /> : null}
  </SettingsScreen>;
}
