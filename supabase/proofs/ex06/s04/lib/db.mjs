// EX-06 S04: the database seam of the proof. The scenarios read and write the DISPOSABLE chain only through this object; the real one (createDb) sends the builders of sql.mjs through the proof
// adapter (psql as the superuser of the loopback stack), the offline tests give the scenarios a simulated world with the same methods (world_sim.mjs). Reads return plain data; the
// writes are the LABELLED fixture and isolation writes of sql.mjs (named accordingly).
import {READ_BUILDERS, WRITE_BUILDERS} from './sql.mjs';

export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** The error text of a failed psql call, bounded: the proof adapter puts the stderr of psql in the message (LOCAL_SQL:...). */
const messageOf = error => String(error?.message ?? error).slice(0, 600);

export function createDb(rt) {
  const {rows, sql} = rt;
  const read = (name, args = {}) => rows(READ_BUILDERS[name](args));
  const one = (name, args) => read(name, args)[0] ?? null;
  const write = (name, args = {}) => sql(WRITE_BUILDERS[name](args));
  return {
    // ---- reads
    needState: needId => one('needState', {needId}),
    deliveries: needId => read('deliveries', {needId}),
    opportunityNotifications: needId => read('opportunityNotifications', {needId}),
    pendingOpportunityNotifications: needId => read('pendingOpportunityNotifications', {needId}),
    scheduleDueCount: at => Number(one('scheduleDueCount', {at}).due),
    scheduleRowsExcept: needId => Number(one('scheduleRowsExcept', {needId}).other),
    cheapGate: (needId, profileId) => one('cheapGate', {needId, profileId}).admitted === true,
    pairBlocked: (a, b) => one('pairBlocked', {a, b}).blocked === true,
    accountRestricted: accountId => one('accountRestricted', {accountId}).restricted === true,
    accountWorld: accountId => one('accountWorld', {accountId}).world,
    profileState: profileId => one('profileState', {profileId}),
    responsesOf: needId => read('responsesOf', {needId}),
    pushSuppression: deliveryId => one('pushSuppression', {deliveryId}).reason,
    notificationDelivery: deliveryId => one('notificationDelivery', {deliveryId}),
    notificationDeliveries: deliveryIds => read('notificationDeliveries', {deliveryIds}),
    materialSnapshot: needId => one('materialSnapshot', {needId}).material,
    emitEventReplay: ({accountId, needId, revision}) => one('emitEventReplay', {accountId, needId, revision}).event_id,
    schemaColumns: () => read('schemaColumns'),
    functionBody: signature => one('functionBody', {signature})?.body ?? null,
    // ---- labelled fixture and isolation writes
    closureFixture: accountId => { write('closureFixture', {accountId}); },
    republishFixture: needId => { write('republishFixture', {needId}); },
    retireNeeds: needIds => { if (needIds.length) write('retireNeedsIsolation', {needIds}); },
    retireAllNeeds: () => { write('retireAllNeedsIsolation'); },
    deleteOtherSchedules: needId => { write('deleteOtherSchedulesIsolation', {needId}); },
    responseDeadlineFixture: (needId, at) => { write('responseDeadlineFixture', {needId, at}); },
    /** The plain insert of a second delivery: {refused, message}. The unique constraint must refuse it. */
    duplicateDeliveryInsert(args) {
      try {
        write('duplicateDeliveryInsert', args);
        return {refused: false, message: null};
      } catch (error) {
        return {refused: true, message: messageOf(error)};
      }
    },
    /** The wave's own insert (on conflict do nothing returning id): the number of rows it added. */
    duplicateDeliveryOnConflict(args) {
      const out = write('duplicateDeliveryOnConflict', args);
      return out === '' ? 0 : out.split('\n').filter(Boolean).length;
    },
  };
}
