import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_RETURN_TARGET_STORAGE_VERSION = 2 as const;
export const AUTH_RETURN_TARGET_KEY = 'uskoci.auth.pending-intent.v2';

export type GuestReturnTarget =
  | { kind: 'NONE' }
  | { kind: 'REQUESTER_DRAFT'; draftKey: string }
  | { kind: 'NEED'; needId: string }
  | { kind: 'DOGOVOR'; agreementId: string };

export type GuestSessionIntent = {
  intent: 'REQUESTER' | 'WORKER';
  returnTarget?: GuestReturnTarget;
};

export type AuthReturnTargetRecordV2 = {
  storageVersion: typeof AUTH_RETURN_TARGET_STORAGE_VERSION;
  recordRevision: number;
  status: 'PENDING' | 'COMPLETED';
  intent: GuestSessionIntent;
  createdAt: string;
  updatedAt: string;
  completedByUserId: string | null;
};

export class AuthReturnTargetStore {
  private serial: Promise<void> = Promise.resolve();

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.serial.then(operation, operation);
    this.serial = result.then(() => undefined, () => undefined);
    return result;
  }

  private async loadUnlocked(): Promise<AuthReturnTargetRecordV2 | null> {
    const raw = await AsyncStorage.getItem(AUTH_RETURN_TARGET_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.storageVersion === AUTH_RETURN_TARGET_STORAGE_VERSION) {
        return parsed;
      }
    } catch {}
    return null;
  }

  async snapshot() {
    return this.runExclusive(async () => this.loadUnlocked());
  }

  async prepare(input: GuestSessionIntent) {
    return this.runExclusive(async () => {
      const previous = await this.loadUnlocked();
      const timestamp = new Date().toISOString();
      const next: AuthReturnTargetRecordV2 = {
        storageVersion: AUTH_RETURN_TARGET_STORAGE_VERSION,
        recordRevision: (previous?.recordRevision ?? 0) + 1,
        status: 'PENDING',
        intent: input,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedByUserId: null,
      };
      await AsyncStorage.setItem(AUTH_RETURN_TARGET_KEY, JSON.stringify(next));
      return next;
    });
  }

  async consumeCompleted(userId: string) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return null;
    return this.runExclusive(async () => {
      const record = await this.loadUnlocked();
      if (!record || record.status !== 'COMPLETED') return null;
      await AsyncStorage.removeItem(AUTH_RETURN_TARGET_KEY);
      if (record.completedByUserId !== normalizedUserId) return null;
      return record;
    });
  }

  async markCompleted(userId: string, input: GuestSessionIntent) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) throw new Error('AUTH_RETURN_TARGET_USER_REQUIRED');
    return this.runExclusive(async () => {
      const previous = await this.loadUnlocked();
      const timestamp = new Date().toISOString();
      const next: AuthReturnTargetRecordV2 = {
        storageVersion: AUTH_RETURN_TARGET_STORAGE_VERSION,
        recordRevision: (previous?.recordRevision ?? 0) + 1,
        status: 'COMPLETED',
        intent: input,
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
        completedByUserId: normalizedUserId,
      };
      await AsyncStorage.setItem(AUTH_RETURN_TARGET_KEY, JSON.stringify(next));
      return next;
    });
  }

  async clear() {
    return this.runExclusive(async () => {
      await AsyncStorage.removeItem(AUTH_RETURN_TARGET_KEY);
    });
  }
}

export const povratniCilj = new AuthReturnTargetStore();
