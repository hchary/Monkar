// Canonical contract for `worldData/tags/items/{tagId}`: the shared vocabulary every other
// component classifies itself with. Referenced by tagIds on quests, narrativeSubjects, objects,
// lootTables, talents, verbPhrases and recettes, and by recette.categoryIds and
// actionType.lootTagIds / recipeCategoryIds. Authored through
// src/components/creator/TagsManager.jsx, which also sweeps every referencing collection on
// delete so no dangling tag id survives.
//
// One entry is reserved: the tag named "objectif de quête" is created at the fixed document id
// OBJECTIVE_TAG_ID ("objectif-de-quete", see src/components/creator/QuestObjectivesManager.jsx) -
// a narrativeSubject carrying that tag id doubles as a quest objective. Renaming (but not
// deleting) that entry is harmless, since every consumer matches on id, not on name.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/tag.ts so the client creator and this file can
// never drift; this file re-exports it under the location/name this project's schema convention
// expects, carrying the collection-level documentation above.
export { TagDocumentSchema } from "../../../shared/schema/tag";
export type { TagDocument } from "../../../shared/schema/tag";
