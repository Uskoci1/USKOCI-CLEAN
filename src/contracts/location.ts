import type { NeedTaskGeography } from './needFactsV2';

/** The existing public topology contains coarse text, never private addresses or GPS. */
export type NeedLocationInput = Readonly<{
  geography: NeedTaskGeography;
  exactAddress: string | null;
  accessNotes: string | null;
}>;
export type NeedLocationReview = Readonly<{
  accountId: string;
  conversationId: string;
  editable: boolean;
  confirmed: boolean;
  revision: string;
  value: Readonly<{ geography: NeedTaskGeography | null; exactAddress: string | null; accessNotes: string | null }>;
}>;
export type NeedLocationSave = Readonly<{
  conversationId: string; expectedRevision: string; confirmed: true; value: NeedLocationInput;
}>;
export type NeedLocationReceipt = Readonly<{
  saved: true; idempotentReplay: boolean; review: NeedLocationReview;
}>;

/** Coordinates, when explicitly supplied, are coarse two-decimal preferences only. */
export type CoarsePosition = Readonly<{ latitude: number; longitude: number }>;
export type WorkerLocationInput = Readonly<{
  city: string; radiusKm: number; approximatePosition: CoarsePosition | null;
}>;
export type WorkerLocation = WorkerLocationInput & Readonly<{
  accountId: string; profileId: string; revision: string;
}>;
export type WorkerLocationSave = Readonly<{
  expectedRevision: string; confirmed: true; value: WorkerLocationInput;
}>;
export type WorkerLocationReceipt = Readonly<{
  saved: true; idempotentReplay: boolean; location: WorkerLocation;
}>;
