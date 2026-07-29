// The four action categories - the first level of tabs in the action panel, in this order.
//
// A category is exactly a root of the action kind tree (src/lib/actionKinds.js): "Aventure" the
// category and "Aventure" the abstract action are the same thing seen from the player's side and
// from the author's side, so the list is derived rather than restated. An action no longer
// carries an authored categoryId - it carries a kindId, and its category is that kind's root
// (see normalizeActionType in actionCatalog.js).
//
// Client-only: the Cloud Functions treat categoryId as an opaque string and never need the
// labels. They do need the kind tree itself, which is why actionKinds.js is mirrored and this
// file is not.

import { ACTION_KINDS } from "./actionKinds";

export const ACTION_CATEGORIES = ACTION_KINDS.filter((kind) => kind.parentId == null).map((kind) => ({
  value: kind.value,
  label: kind.label,
}));
