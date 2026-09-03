export const NEED_FACT_SCHEMA_V2 = 'NEED_FACT_V2' as const;
export const LEGACY_FACT_SCHEMA_V1 = 'LEGACY_TEXT_V1' as const;

export type NeedFactValueType =
  | 'TEXT'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'ENUM'
  | 'TIMESTAMPTZ'
  | 'TEXT_ARRAY'
  | 'OBJECT';

export type NeedFactPrivacyClass = 'PUBLIC' | 'PRIVATE';

export const NEED_FACT_V2_DEFINITIONS = {
  'need.title': { valueType: 'TEXT', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Naslov' },
  'need.description': { valueType: 'TEXT', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Opis' },
  'need.category': { valueType: 'TEXT', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Kategorija' },
  'need.price_mode': { valueType: 'ENUM', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Cena' },
  'need.price_rsd': { valueType: 'INTEGER', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Iznos' },
  'need.schedule_kind': { valueType: 'ENUM', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Termin' },
  'need.starts_at': { valueType: 'TIMESTAMPTZ', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Početak' },
  'need.ends_at': { valueType: 'TIMESTAMPTZ', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Kraj' },
  'need.people_needed': { valueType: 'INTEGER', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Ljudi' },
  'need.required_skills': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Veštine' },
  'need.required_tools': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Alat' },
  'need.required_vehicles': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Vozilo' },
  'need.required_licenses': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Dozvole' },
  'need.minimum_experience_years': { valueType: 'INTEGER', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Iskustvo' },
  'need.verified_identity_required': { valueType: 'BOOLEAN', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Potvrđen identitet' },
  'need.task_geography': { valueType: 'OBJECT', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Lokacija' },
  'need.critical_conditions': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Bitni uslovi' },
  'need.public_photo_paths': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Fotografije' },
  'need.exact_address': { valueType: 'TEXT', privacyClass: 'PRIVATE', requiredForDraft: false, label: 'Tačna adresa' },
  'need.access_notes': { valueType: 'TEXT', privacyClass: 'PRIVATE', requiredForDraft: false, label: 'Pristup' },
} as const satisfies Record<string, {
  valueType: NeedFactValueType;
  privacyClass: NeedFactPrivacyClass;
  requiredForDraft: boolean;
  label: string;
}>;

export type NeedFactV2Key = keyof typeof NEED_FACT_V2_DEFINITIONS;
export const NEED_FACT_V2_KEYS = Object.keys(NEED_FACT_V2_DEFINITIONS) as NeedFactV2Key[];
export const REQUIRED_NEED_FACT_V2_KEYS = NEED_FACT_V2_KEYS.filter(
  (key) => NEED_FACT_V2_DEFINITIONS[key].requiredForDraft,
);

export type NeedTaskGeographyMode =
  | 'STATIONARY'
  | 'POINT_TO_POINT'
  | 'MULTI_STOP'
  | 'AREA_BASED'
  | 'REMOTE';

export type NeedTaskGeographyPoint = {
  label?: string;
  city?: string;
  area?: string;
};

export type NeedTaskGeography = {
  mode: NeedTaskGeographyMode;
  start?: NeedTaskGeographyPoint;
  end?: NeedTaskGeographyPoint;
  waypoints?: NeedTaskGeographyPoint[];
};

export type NeedFactV2Value = string | number | boolean | string[] | NeedTaskGeography;

export function isNeedFactV2Key(value: string): value is NeedFactV2Key {
  return Object.prototype.hasOwnProperty.call(NEED_FACT_V2_DEFINITIONS, value);
}

export function factDisplayLabel(key: NeedFactV2Key): string {
  return NEED_FACT_V2_DEFINITIONS[key].label;
}

export function isPrivateNeedFact(key: NeedFactV2Key): boolean {
  return NEED_FACT_V2_DEFINITIONS[key].privacyClass === 'PRIVATE';
}
