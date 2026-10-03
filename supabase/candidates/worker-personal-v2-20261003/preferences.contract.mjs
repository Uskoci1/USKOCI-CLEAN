/**
 * Isolated WPP02 contract candidate. Not imported by the app, Edge or SQL.
 * These pure rules are executable specification, not persistence/SQL proof.
 */
export const WORK_KINDS = Object.freeze([
  'SELIDBE_PREVOZ', 'FIZICKI_POSLOVI', 'MONTAZA_NAMESTAJA', 'SITNE_POPRAVKE',
  'MOLERSKI_RADOVI', 'ELEKTRO', 'VODOINSTALATER', 'CISCENJE',
  'PRANJE_PEGLANJE', 'BASTA_DVORISTE', 'DOSTAVA',
]);
const set = new Set(WORK_KINDS);
const INVALID = () => { throw new Error('WORKER_V2_INVALID'); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function exact(value, fields) {
  if (!record(value) || Object.keys(value).length !== fields.length
    || fields.some(key => !Object.hasOwn(value, key))) INVALID();
}
function allowed(value, fields) {
  if (!record(value) || Object.keys(value).some(key => !fields.includes(key))) INVALID();
}
function boolean(value) { if (typeof value !== 'boolean') INVALID(); return value; }
function nullableBoolean(value) { return value === null ? null : boolean(value); }
function kinds(value) {
  if (!Array.isArray(value) || value.length > WORK_KINDS.length
    || value.some(kind => typeof kind !== 'string' || !set.has(kind))
    || new Set(value).size !== value.length) INVALID();
  // Preserve the reviewed list order. No alias expansion or guessed category.
  return [...value];
}
function notes(value) {
  if (!Array.isArray(value) || value.length > 20
    || value.some(note => typeof note !== 'string' || !note.trim() || [...note].length > 500)
    || new Set(value).size !== value.length) INVALID();
  // Preserve authored wording. These strings are descriptive, never executable predicates.
  return [...value];
}
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) INVALID();
  return value;
}
export function experienceYears(value) {
  if (!Number.isInteger(value) || value < 0 || value > 80) INVALID();
  return value;
}

const FULL_KEYS = ['registryVersion', 'registrySha256', 'desiredWorkKinds', 'declinedWorkKinds',
  'workNotes', 'proactiveNotifications', 'urgentTasksEnabled', 'legacySameDayUrgentNotifications', 'notifications'];
const EDIT_KEYS = ['desiredWorkKinds', 'declinedWorkKinds', 'workNotes', 'proactiveNotifications', 'urgentTasksEnabled', 'notifications'];
const NOTIFICATION_KEYS = ['opportunitiesEnabled', 'urgentDuringQuietHours'];
export function readWorkPreferences(value) {
  exact(value, FULL_KEYS);
  if (typeof value.registryVersion !== 'string' || !/^WK-[1-9][0-9]*$/.test(value.registryVersion)
    || typeof value.registrySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.registrySha256)) INVALID();
  exact(value.notifications, ['revision', ...NOTIFICATION_KEYS]);
  return {
    registryVersion: value.registryVersion, registrySha256: value.registrySha256,
    desiredWorkKinds: kinds(value.desiredWorkKinds), declinedWorkKinds: kinds(value.declinedWorkKinds),
    workNotes: notes(value.workNotes),
    proactiveNotifications: boolean(value.proactiveNotifications),
    urgentTasksEnabled: nullableBoolean(value.urgentTasksEnabled),
    legacySameDayUrgentNotifications: boolean(value.legacySameDayUrgentNotifications),
    notifications: { revision: revision(value.notifications.revision),
      opportunitiesEnabled: boolean(value.notifications.opportunitiesEnabled),
      urgentDuringQuietHours: boolean(value.notifications.urgentDuringQuietHours) },
  };
}
export function readWorkPreferencesPatch(value) {
  allowed(value, EDIT_KEYS);
  const next = {};
  for (const field of ['desiredWorkKinds', 'declinedWorkKinds']) {
    if (Object.hasOwn(value, field)) next[field] = kinds(value[field]);
  }
  if (Object.hasOwn(value, 'workNotes')) next.workNotes = notes(value.workNotes);
  if (Object.hasOwn(value, 'proactiveNotifications')) next.proactiveNotifications = boolean(value.proactiveNotifications);
  if (Object.hasOwn(value, 'urgentTasksEnabled')) next.urgentTasksEnabled = nullableBoolean(value.urgentTasksEnabled);
  if (Object.hasOwn(value, 'notifications')) {
    allowed(value.notifications, NOTIFICATION_KEYS); next.notifications = {};
    for (const field of NOTIFICATION_KEYS) {
      if (Object.hasOwn(value.notifications, field)) next.notifications[field] = boolean(value.notifications[field]);
    }
  }
  return next;
}
export function patchWorkPreferences(base, patch) {
  const current = readWorkPreferences(base), delta = readWorkPreferencesPatch(patch);
  return readWorkPreferences({ ...current, ...delta, notifications: { ...current.notifications, ...delta.notifications } });
}

/**
 * Additional dispatch filters ONLY. Caller must retain existing hard eligibility,
 * skills, equipment, location/calendar, world and fee gates. This never grants a
 * manual response or delivery. Legacy same-day is computed by the existing SQL.
 */
export function additionalDispatchBlockers(raw, task, registry) {
  const preferences = readWorkPreferences(raw);
  exact(task, ['workKinds', 'urgent', 'legacySameDayUrgent']);
  const taskKinds = kinds(task.workKinds);
  boolean(task.urgent); boolean(task.legacySameDayUrgent);
  exact(registry, ['version', 'sha256']);
  if (registry.version !== preferences.registryVersion || registry.sha256 !== preferences.registrySha256) {
    throw new Error('WORKER_V2_REGISTRY_STALE');
  }
  const blockers = [];
  if (!preferences.proactiveNotifications) blockers.push('PROACTIVE_NOTIFICATIONS_PAUSED');
  if (taskKinds.some(kind => preferences.declinedWorkKinds.includes(kind))) blockers.push('DECLINED_WORK_KIND');
  if (preferences.desiredWorkKinds.length && !taskKinds.some(kind => preferences.desiredWorkKinds.includes(kind))) {
    blockers.push('OUTSIDE_DESIRED_WORK_KINDS');
  }
  if (task.urgent && (preferences.urgentTasksEnabled === false
    || (preferences.urgentTasksEnabled === null && task.legacySameDayUrgent && !preferences.legacySameDayUrgentNotifications))) {
    blockers.push(preferences.urgentTasksEnabled === false ? 'URGENT_TASKS_PAUSED' : 'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED');
  }
  return { blockers, manualEligibilityChanged: false };
}

/** Production writer must call this logic while holding the existing owner/role lock. */
export function mergeReviewedNotifications(currentSettings, currentRevision, raw) {
  const preferences = readWorkPreferences(raw);
  revision(currentRevision);
  if (currentRevision !== preferences.notifications.revision) throw new Error('WORKER_AI_STALE');
  if (!record(currentSettings)) INVALID();
  boolean(currentSettings.opportunities_enabled); boolean(currentSettings.urgent_overrides_quiet_hours);
  const settings = { ...currentSettings,
    opportunities_enabled: preferences.notifications.opportunitiesEnabled,
    urgent_overrides_quiet_hours: preferences.notifications.urgentDuringQuietHours };
  return { expectedRevision: currentRevision,
    changed: settings.opportunities_enabled !== currentSettings.opportunities_enabled
      || settings.urgent_overrides_quiet_hours !== currentSettings.urgent_overrides_quiet_hours,
    settings };
}
