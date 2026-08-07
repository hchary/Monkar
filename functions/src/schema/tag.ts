// Canonical contract for `worldData/tags/items/{tagId}`: the shared vocabulary every other
// component classifies itself with. Referenced by tagIds on quests, narrativeSubjects, objects,
// lootTables, talents, verbPhrases and recettes, and by recette.categoryIds and
// actionType.lootTagIds / recipeCategoryIds. Authored through
// src/components/creator/TagsManager.jsx, which also sweeps every referencing collection on
// delete so no dangling tag id survives.
//
// LEGACY: the tag doc at id "objectif-de-quete" ("objectif de quête") used to be reserved - a
// narrativeSubject carrying that tag id doubled as a quest objective. That mechanic was retired by
// "Retiring quests and quest objectives for the subject-action system" (docs/TODO.md); the tag doc
// itself, if it still exists, is now an ordinary tag with no special meaning to any consumer.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/tag.ts so the client creator and this file can
// never drift; this file re-exports it under the location/name this project's schema convention
// expects, carrying the collection-level documentation above.
export { TagDocumentSchema } from "../../../shared/schema/tag";
export type { TagDocument } from "../../../shared/schema/tag";
