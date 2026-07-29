// The action kind tree - the "class hierarchy" an action type is an instance of.
//
// Mirrored verbatim (bodies identical, only the export syntax differs) in src/lib/actionKinds.js,
// so the creator UI, the player UI and the Cloud Functions all derive a kind's category and its
// ancestry from the exact same table. functions/ is CommonJS with no build step shared with the
// Vite app, so a duplicated pure module is the established answer here - same convention as
// actionConditions.js / actionLifecycle.js. This copy is the one covered by tests
// (actionKinds.test.js); keep the other in step when editing.
//
// A kind is what "Partir en quête est une action héritant de l'action abstraite Aventure" means
// in data: the action document carries kindId, the kind carries the behaviour shared by every
// action beneath it. Today the tree is four roots deep by one, plus Récolte under Métier; the
// point of the parentId edge is that Métier will grow more children (Artisanat, Transport,
// Recherche…), each inheriting Métier's profession gate without restating it.
//
// Small fixed enums live in JS rather than Firestore here (docs/ISSUE-02-ACTION-FRAMEWORK.md D6),
// same as DIFFICULTIES / RARITIES / OBJECT_TYPES. Labels are French - creator-facing UI text.
//
// Every kind is selectable by an action: "abstract" describes the modelling (a kind is a class,
// never an action), not a rule the code enforces, so there is no flag for it.

const ACTION_KINDS = [
  { value: "aventure", label: "Aventure", parentId: null },
  { value: "intermede", label: "Intermède", parentId: null },
  { value: "metier", label: "Métier", parentId: null },
  { value: "social", label: "Social", parentId: null },
  { value: "recolte", label: "Récolte", parentId: "metier" },
  { value: "artisanat", label: "Artisanat", parentId: "metier" },
];

// The kind whose descendants are reserved to characters practising one of the action's
// professions. Named rather than inlined because both the catalog (which injects the implicit
// condition) and the creator UI (which shows the "Métiers associés" picker) ask the same question.
const PROFESSION_ACTION_KIND_ID = "metier";

// The kind whose descendants draw from a loot table (picked by tag + rarity) instead of - or in
// addition to - a rolled tier. Named the same way as PROFESSION_ACTION_KIND_ID: both the creator
// UI (which shows the "Tags de butin"/"Rareté" fields) and the server handler ask the same
// question.
const HARVEST_ACTION_KIND_ID = "recolte";

// The kind whose descendants resolve a recette (worldData/recettes/items) instead of a rolled
// tier: consuming its ingredients and producing its results. Same convention as
// HARVEST_ACTION_KIND_ID - both the creator UI (which shows the "Catégories de recettes" field)
// and the "artisanat" handler ask the same question.
const CRAFTING_ACTION_KIND_ID = "artisanat";

function findActionKind(kindId) {
  return ACTION_KINDS.find((kind) => kind.value === kindId) || null;
}

// The chain from this kind up to its root, nearest first: ["recolte", "metier"]. An unknown kind
// yields [] - callers then fail closed or fall back, never guess. The iteration is bounded by the
// table's own length so a mis-authored parentId cycle can't hang the render loop.
function actionKindAncestry(kindId) {
  const chain = [];
  let current = findActionKind(kindId);
  while (current && chain.length <= ACTION_KINDS.length) {
    chain.push(current.value);
    current = current.parentId ? findActionKind(current.parentId) : null;
  }
  return chain;
}

// Inheritance, including the reflexive case: a Métier action is itself "of kind Métier".
function actionKindInheritsFrom(kindId, ancestorKindId) {
  return actionKindAncestry(kindId).includes(ancestorKindId);
}

// A kind's category is its root ancestor, which is why the four roots share the four category
// ids: categoryId stops being authored and becomes derived (see actionCatalog.js).
function actionKindCategoryId(kindId) {
  const chain = actionKindAncestry(kindId);
  return chain.length > 0 ? chain[chain.length - 1] : null;
}

function actionKindLabel(kindId) {
  return findActionKind(kindId)?.label || "";
}

// Depth-first order with each kind's depth, for rendering the tree as an indented flat list
// (a <select> can't nest, and the creator UI needs the hierarchy to be readable).
function actionKindsInTreeOrder(parentId = null, depth = 0) {
  return ACTION_KINDS.filter((kind) => kind.parentId === parentId).flatMap((kind) => [
    { ...kind, depth },
    ...actionKindsInTreeOrder(kind.value, depth + 1),
  ]);
}

module.exports = {
  ACTION_KINDS,
  PROFESSION_ACTION_KIND_ID,
  HARVEST_ACTION_KIND_ID,
  CRAFTING_ACTION_KIND_ID,
  findActionKind,
  actionKindAncestry,
  actionKindInheritsFrom,
  actionKindCategoryId,
  actionKindLabel,
  actionKindsInTreeOrder,
};
