// Keeps the two ends of the profession ⇄ action link in step.
//
// The link is stored on both sides - worldData/actionTypes/items/{id}.professionIds and
// worldData/professions/items/{id}.actionIds - because both are read directly, without a join:
// the availability gate needs the action's professions (actionCatalog.js), and the character
// sheet's Métier tab needs the profession's actions (ProfessionTab.jsx). Editing either side
// writes both, in one batch, so the pair can't half-commit.
//
// There is no Cloud Function in front of worldData (it is creator-write per firestore.rules), so
// this runs in the creator's browser rather than in a trigger. The one failure mode that leaves
// is a concurrent delete: batch.update on a document another creator just removed fails the whole
// batch with not-found, and the creator retries against the refreshed list. That is preferable to
// a partial write, which is what a per-document loop would give.

import { doc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "./firebase";

export const actionTypeRef = (actionId) => doc(db, "worldData", "actionTypes", "items", actionId);
export const professionRef = (professionId) => doc(db, "worldData", "professions", "items", professionId);

// What changed between two id lists. Only the difference is written, so two creators editing
// unrelated links on the same document don't clobber each other's arrays.
export function diffIds(previous, next) {
  const before = previous || [];
  const after = next || [];
  return {
    added: after.filter((id) => !before.includes(id)),
    removed: before.filter((id) => !after.includes(id)),
  };
}

// "Associer un métier à une action de métier ajoute automatiquement l'action dans les actions
// associées au métier" - the action-side half.
export function syncActionProfessions(batch, actionId, previousProfessionIds, nextProfessionIds) {
  const { added, removed } = diffIds(previousProfessionIds, nextProfessionIds);
  for (const professionId of added) batch.update(professionRef(professionId), { actionIds: arrayUnion(actionId) });
  for (const professionId of removed) batch.update(professionRef(professionId), { actionIds: arrayRemove(actionId) });
}

// "…et vice versa" - the profession-side half.
export function syncProfessionActions(batch, professionId, previousActionIds, nextActionIds) {
  const { added, removed } = diffIds(previousActionIds, nextActionIds);
  for (const actionId of added) batch.update(actionTypeRef(actionId), { professionIds: arrayUnion(professionId) });
  for (const actionId of removed) batch.update(actionTypeRef(actionId), { professionIds: arrayRemove(professionId) });
}

// Deleting one end drops the reference from the other, so a dangling id never survives the
// operation that created it. Both take the live list the manager already subscribes to, and only
// touch the documents that actually point back.
export function unlinkDeletedAction(batch, actionId, professions) {
  for (const profession of professions) {
    if ((profession.actionIds || []).includes(actionId)) {
      batch.update(professionRef(profession.id), { actionIds: arrayRemove(actionId) });
    }
  }
}

export function unlinkDeletedProfession(batch, professionId, actionTypes) {
  for (const actionType of actionTypes) {
    if ((actionType.professionIds || []).includes(professionId)) {
      batch.update(actionTypeRef(actionType.id), { professionIds: arrayRemove(professionId) });
    }
  }
}
