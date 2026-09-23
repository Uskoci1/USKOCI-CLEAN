import { DetailLink } from '../product/ProductDetails';

/**
 * Entry to the Task's public Q&A: one flat row in the task's own reading order, not a card with a
 * shadow of its own. The spoken label says what the press does; the Q&A screen owns the flow.
 */
export function TaskQaEntry({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return <DetailLink art="chat" label="Pitanja i odgovori" accessibilityLabel="Otvori pitanja i odgovore" disabled={disabled} onPress={onPress} />;
}
