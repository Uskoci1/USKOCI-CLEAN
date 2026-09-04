import {
  mapirajStanjeMojePrijave,
  mozeIzmenaJavnogZadatka,
  resetujRu4Fake,
  ru4FakeSource,
} from '../ru4Source';

describe('RU-4 — client revision contract', () => {
  beforeEach(() => resetujRu4Fake());

  it('nudi izmenu samo dok je Zadatak javno otvoren za preselection', () => {
    expect(mozeIzmenaJavnogZadatka('OBJAVLJENA')).toBe(true);
    expect(mozeIzmenaJavnogZadatka('CEKA_PRIJAVE')).toBe(true);
    expect(mozeIzmenaJavnogZadatka('DELIMICNO_POPUNJENA')).toBe(true);
    expect(mozeIzmenaJavnogZadatka('NACRT')).toBe(false);
    expect(mozeIzmenaJavnogZadatka('POPUNJENA')).toBe(false);
    expect(mozeIzmenaJavnogZadatka('ZATVORENA')).toBe(false);
  });

  it('legacy STALE i novi status imaju isti fail-safe proizvodni ishod', () => {
    expect(mapirajStanjeMojePrijave('STALE')).toBe('STALE_REVIEW_REQUIRED');
    expect(mapirajStanjeMojePrijave('STALE_REVIEW_REQUIRED')).toBe('STALE_REVIEW_REQUIRED');
    expect(mapirajStanjeMojePrijave('SELECTED')).toBe('IZABRANA');
    expect(mapirajStanjeMojePrijave('SUBMITTED')).toBe('IZBORNA');
  });

  it('prvo pravi novu privatnu reviziju, pa DRAFT izmena ne diže reviziju ponovo', async () => {
    const priprema = await ru4FakeSource.pripremiIzmenu({
      zadatakId: 'z-1',
      ocekivanaRevizija: 4,
      clientRequestId: 'ru4-test-prepare-1',
    });
    expect(priprema.ok).toBe(true);
    if (!priprema.ok) return;
    expect(priprema.podatak.revizija).toBe(5);

    const pre = await ru4FakeSource.nacrtIzmene('z-1');
    expect(pre.ok).toBe(true);
    if (!pre.ok) return;

    const save = await ru4FakeSource.sacuvajNacrt({
      zadatakId: 'z-1',
      ocekivanaRevizija: pre.podatak.revizija,
      naslov: 'Izmenjen naslov',
      opis: 'Izmenjen opis Zadatka',
      grad: 'Novi Sad',
      podrucje: 'Liman',
      brojMesta: 3,
      rezimCene: pre.podatak.rezimCene,
      cenaRsd: pre.podatak.cenaRsd,
    });
    expect(save.ok).toBe(true);
    if (!save.ok) return;
    expect(save.podatak.revizija).toBe(5);

    const posle = await ru4FakeSource.nacrtIzmene('z-1');
    expect(posle.ok).toBe(true);
    if (!posle.ok) return;
    expect(posle.podatak.naslov).toBe('Izmenjen naslov');
    expect(posle.podatak.revizija).toBe(5);
  });

  it('odbija čuvanje protiv zastarele očekivane revizije', async () => {
    await ru4FakeSource.pripremiIzmenu({
      zadatakId: 'z-2',
      ocekivanaRevizija: 2,
      clientRequestId: 'ru4-test-prepare-2',
    });

    const save = await ru4FakeSource.sacuvajNacrt({
      zadatakId: 'z-2',
      ocekivanaRevizija: 2,
      naslov: 'Zastareo pokušaj',
      opis: 'Ne sme da se sačuva na staroj reviziji.',
      grad: 'Novi Sad',
      podrucje: 'Centar',
      brojMesta: 1,
      rezimCene: 'OFFERS',
      cenaRsd: null,
    });

    expect(save.ok).toBe(false);
    if (save.ok) return;
    expect(save.kod).toBe('STALE_REVIEW_REQUIRED');
  });
});
