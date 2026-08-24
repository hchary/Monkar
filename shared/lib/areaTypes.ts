// The area-type enum every mission generation pass matches on: a region sits in an Area
// (worldData/areas/items, see shared/schema/area.ts), and the monsters eligible for a mission
// there are the ones whose resolved `areaType` equals that Area's `type`.
//
// Mirrors the Python model's `AreaType` with its typo corrected. Stored keys are unaccented and
// snake_cased, matching every other stored enum in this repo (DIFFICULTIES, RARITIES, ACTION_KINDS);
// the French labels below are display-only and can be reworded without a migration.
//
// Lives in shared/ rather than src/lib/ because both sides need the same list: the creator's
// Area/Monster pages write the key, and the Cloud Functions generation pass reads it.

export const AREA_TYPES = [
  { value: "ville", label: "Ville" },
  { value: "marais", label: "Marais" },
  { value: "grotte", label: "Grotte" },
  { value: "plaine", label: "Plaine" },
  { value: "montagne", label: "Montagne" },
  { value: "desert", label: "Désert" },
  { value: "ruines_anciennes", label: "Ruines anciennes" },
  { value: "volcan", label: "Volcan" },
] as const;

export type AreaTypeValue = (typeof AREA_TYPES)[number]["value"];

export const AREA_TYPE_VALUES: AreaTypeValue[] = AREA_TYPES.map((type) => type.value);

// Display label for a stored key, falling back to the key itself so an unknown/legacy value still
// renders instead of blanking out.
export function areaTypeLabel(value: string): string {
  return AREA_TYPES.find((type) => type.value === value)?.label ?? value;
}
