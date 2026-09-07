import { Redirect } from 'expo-router';
import { useUloga } from '../../store/uloga';

/** Compatibility root for existing links; S05/R01/W01 are retired. */
export default function IntentRoot() {
  const intent = useUloga();
  return <Redirect href={intent === 'narucilac' ? '/potrebe' : '/moje-prijave'} />;
}
