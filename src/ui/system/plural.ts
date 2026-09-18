/**
 * Serbian counts in three shapes, not one.
 *
 * "1 zadataka" was on the map legend, because the app was counting the way English does. The shape
 * is chosen by the last two digits: 11–14 always take the third form, otherwise a final 1 takes the
 * first and a final 2, 3 or 4 the second.
 *
 * The caller passes the three words because only the caller knows them: `plural(n, 'zadatak',
 * 'zadatka', 'zadataka')`, `plural(n, 'Dogovor', 'Dogovora', 'Dogovora')`.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const hundred = Math.abs(count) % 100, ten = Math.abs(count) % 10;
  if (hundred >= 11 && hundred <= 14) return `${count} ${many}`;
  if (ten === 1) return `${count} ${one}`;
  if (ten >= 2 && ten <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

export const zadataka = (count: number) => plural(count, 'zadatak', 'zadatka', 'zadataka');
export const dogovora = (count: number) => plural(count, 'Dogovor', 'Dogovora', 'Dogovora');
// Lower case: this one is used inside a sentence ("3 prijave za pregled"), while a Zadatak and a
// Dogovor are named as such wherever they are counted.
export const prijava = (count: number) => plural(count, 'prijava', 'prijave', 'prijava');
