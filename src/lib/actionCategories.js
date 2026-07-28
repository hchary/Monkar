// The four action categories, as a fixed enum rather than a Firestore collection - same
// convention as DIFFICULTIES (QuestsManager.jsx), RARITIES (TalentsManager.jsx), and
// OBJECT_TYPES (ObjectsManager.jsx). Client-only: the Cloud Functions treat categoryId as an
// opaque string and never need the labels.
//
// The first level of tabs in the action panel, in this order. Labels are French - in-game text.
export const ACTION_CATEGORIES = [
  { value: "aventure", label: "Aventure" },
  { value: "intermede", label: "Intermède" },
  { value: "metier", label: "Métier" },
  { value: "social", label: "Social" },
];

export function actionCategoryLabel(categoryId) {
  return ACTION_CATEGORIES.find((category) => category.value === categoryId)?.label || "";
}
