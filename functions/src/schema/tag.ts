// Canonical contract for `worldData/tags/items/{tagId}`: the shared vocabulary every other
// component classifies itself with. Referenced by tagIds on quests, narrativeSubjects, objects,
// lootTables, talents and recettes, and by recette.categoryIds and actionType.lootTagIds /
// recipeCategoryIds. Authored through src/components/creator/TagsManager.jsx, which also sweeps
// every referencing collection on delete so no dangling tag id survives.
//
// Beware the two parallel systems: this catalog is referenced by *id*, while verbPhrase.tags and
// narrativeSubject.tags are free-text *names* that must be spelled exactly like a tag's name here
// (see functions/src/textGeneration.js). Renaming a tag does not update those strings.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/tag.ts so the client creator and this file can
// never drift; this file re-exports it under the location/name this project's schema convention
// expects, carrying the collection-level documentation above.
export { TagDocumentSchema } from "../../../shared/schema/tag";
export type { TagDocument } from "../../../shared/schema/tag";
