import { taskPlace } from '../../ui/v2/TaskFace';

describe('taskPlace route list copy', () => {
  it('shows only the public start location for a point-to-point task card', () => {
    const item = {
      podrucjeTekst: 'Novi Sad',
      detalji: {
        geografija: {
          mode: 'POINT_TO_POINT',
          start: { area: 'Lenke Dunđerski', city: 'Novi Sad' },
          end: { area: 'Dositejeva', city: 'Novi Sad' },
        },
      },
    } as any;
    expect(taskPlace(item)).toEqual({ remote: false, text: 'Lenke Dunđerski' });
  });

  it('shows the first public stop for a multi-stop task card and keeps stationary fallback unchanged', () => {
    const route = {
      podrucjeTekst: 'Novi Sad',
      detalji: { geografija: { mode: 'MULTI_STOP', start: { city: 'Petrovaradin' },
        waypoints: [{ city: 'Novi Sad' }], end: { city: 'Veternik' } } },
    } as any;
    expect(taskPlace(route)).toEqual({ remote: false, text: 'Petrovaradin' });

    const stationary = { podrucjeTekst: 'Liman, Novi Sad', detalji: { geografija: { mode: 'STATIONARY', start: { city: 'Novi Sad' } } } } as any;
    expect(taskPlace(stationary)).toEqual({ remote: false, text: 'Liman, Novi Sad' });
  });
});
