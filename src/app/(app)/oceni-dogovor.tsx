import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesija } from '../../store/sesija';
import { uuid } from '../../data/serverReceipt';
import { AgreementReviewScreen, backFromReview } from '../../ui/reviews/AgreementReviewScreen';
import { sys } from '../../ui/system/tokens';
import { T } from '../../ui/Text';
import { V2Action } from '../../ui/v2/V2Action';

export default function OceniDogovor() {
  const { agreementId } = useLocalSearchParams<{ agreementId: string | string[] }>();
  const session = useSesija();
  if (!uuid(agreementId) || !session.user) return <SafeAreaView style={{ flex: 1, padding: 24, gap: 16, backgroundColor: sys.color.ground }}>
    <T accessibilityRole="header" variant="title" style={{ color: sys.color.ink }}>Ocena nije dostupna</T>
    <T variant="body" tone="muted">Otvori završeni Dogovor iz svog naloga.</T>
    <V2Action label="Nazad na Dogovore" onPress={backFromReview} />
  </SafeAreaView>;
  return <AgreementReviewScreen key={`${session.user.id}:${session.accountRevision}:${agreementId}`}
    agreementId={agreementId} accountId={session.user.id} accountRevision={session.accountRevision} />;
}
