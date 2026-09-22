// Synthetic provider metadata for transport tests. ANSWER deliberately preserves
// their arbitrary fixture prose; semantic tests provide explicit actions instead.
export const syntheticDialogue = () => ({next:'ANSWER',questionKey:'',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'});
export const withDialogue = output => ({dialogue:syntheticDialogue(),...output});
