import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ACTION_CATEGORIES } from "../../lib/actionCategories";
import { normalizeActionType, evaluateAvailability } from "../../lib/actionCatalog";
import MissionPicker from "./MissionPicker";
import TalentPicker from "./TalentPicker";
import ProfessionPicker from "./ProfessionPicker";

// hasInstanceTag needs the tag set of everything the character owns, resolved through the object
// catalog exactly like the server's buildConditionContext (functions/src/lib/actionContext.js) -
// duplicated here as component state rather than a mirrored module, since (per that module's own
// comment) the client is expected to build this from its own snapshots, and unlike the server
// this isn't gated behind a per-call read cost.
function useInstanceTagIds(characterId, ownerUid) {
  const [objectTagsById, setObjectTagsById] = useState(new Map());
  const [ownedObjectIds, setOwnedObjectIds] = useState([]);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "objects", "items"), (snap) => {
      setObjectTagsById(new Map(snap.docs.map((d) => [d.id, d.data().tagIds || []])));
    });
  }, []);

  useEffect(() => {
    // The security rule authorizes instances reads on ownerUid, not characterId - a query
    // filtered on characterId alone can't prove to Firestore that every possible match would
    // satisfy that rule, so it's denied outright regardless of what the data actually contains.
    // Both filters are required for the same reason InventoryTab needs them.
    const q = query(
      collection(db, "instances"),
      where("ownerUid", "==", ownerUid),
      where("characterId", "==", characterId)
    );
    return onSnapshot(q, (snap) => {
      setOwnedObjectIds(snap.docs.map((d) => d.data().objectId));
    });
  }, [characterId, ownerUid]);

  return useMemo(() => {
    const tagIds = new Set();
    for (const objectId of ownedObjectIds) {
      for (const tagId of objectTagsById.get(objectId) || []) tagIds.add(tagId);
    }
    return tagIds;
  }, [ownedObjectIds, objectTagsById]);
}

// trainerReachable needs every worldData/trainerTypes/items entry reachable from the character's
// current region, resolved through the region doc exactly like the server's
// buildReachableTrainerTypeIds (functions/src/lib/actionContext.js) - duplicated here as
// component state rather than a mirrored module, same convention as useInstanceTagIds above.
function useReachableTrainerTypeIds(regionId) {
  const [adventureZoneIds, setAdventureZoneIds] = useState([]);
  const [trainerTypes, setTrainerTypes] = useState([]);

  useEffect(() => {
    if (!regionId) {
      setAdventureZoneIds([]);
      return;
    }
    return onSnapshot(doc(db, "worldData", "regions", "items", regionId), (snap) => {
      setAdventureZoneIds(snap.exists() ? snap.data().adventureZoneIds || [] : []);
    });
  }, [regionId]);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "trainerTypes", "items"), (snap) => {
      setTrainerTypes(snap.docs.map((d) => ({ id: d.id, locationId: d.data().locationId || "" })));
    });
  }, []);

  return useMemo(() => {
    const reachable = new Set();
    for (const trainerType of trainerTypes) {
      if (adventureZoneIds.includes(trainerType.locationId)) reachable.add(trainerType.id);
    }
    return reachable;
  }, [trainerTypes, adventureZoneIds]);
}

// R7/R8/R9: two nested tab rows - categories, then that category's actions - reusing the
// `.tab-list` / `.tab-content` styling already used by `.character-tabs`, so the wrapping flex
// layout that keeps that panel usable under 720px (F12) applies here for free.
//
// Availability here is display-only (§3.9): the Cloud Function re-evaluates the same conditions
// as the authority, through the mirrored evaluator (src/lib/actionConditions.js). An action whose
// conditions fail is hidden or shown disabled with its unmetMessage, per the action's own
// unmetBehaviour.
export default function ActionBrowser({ character, actionTypes, onStart, submitting, error }) {
  const instanceTagIds = useInstanceTagIds(character.id, character.ownerUid);
  const reachableTrainerTypeIds = useReachableTrainerTypeIds(character.region?.id);
  const ctx = { character, instanceTagIds, reachableTrainerTypeIds };

  const categories = useMemo(() => {
    const normalized = actionTypes.map((a) => ({ ...normalizeActionType(a), id: a.id })).filter((a) => a.enabled);

    return ACTION_CATEGORIES.map((category) => ({
      ...category,
      actions: normalized
        .filter((a) => a.categoryId === category.value)
        .map((a) => ({ ...a, availability: evaluateAvailability(a, ctx) }))
        .filter((a) => a.availability.ok || a.availability.behaviour === "disable")
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    }));
  }, [actionTypes, character, instanceTagIds, reachableTrainerTypeIds]);

  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeActionId, setActiveActionId] = useState(null);

  // The default selected category is the first with at least one action the character can
  // actually start - once the player picks one themselves, later re-evaluations (a talent
  // granted, an item picked up) never override that choice.
  useEffect(() => {
    if (activeCategoryId != null) return;
    const firstAvailable = categories.find((c) => c.actions.some((a) => a.availability.ok));
    const fallback = firstAvailable ?? categories[0];
    if (fallback) setActiveCategoryId(fallback.value);
  }, [categories, activeCategoryId]);

  const activeCategory = categories.find((c) => c.value === activeCategoryId) ?? categories[0];

  useEffect(() => {
    if (!activeCategory) return;
    if (activeCategory.actions.some((a) => a.id === activeActionId)) return;
    const firstAvailable = activeCategory.actions.find((a) => a.availability.ok);
    setActiveActionId((firstAvailable ?? activeCategory.actions[0])?.id ?? null);
  }, [activeCategory]);

  const activeAction = activeCategory?.actions.find((a) => a.id === activeActionId);

  return (
    <div className="action-browser">
      <div className="tab-list">
        {ACTION_CATEGORIES.map((category) => (
          <button
            key={category.value}
            type="button"
            className={category.value === activeCategory?.value ? "selected" : ""}
            onClick={() => setActiveCategoryId(category.value)}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeCategory?.actions.length === 0 && (
          <p className="empty-state">Aucune action disponible dans cette catégorie pour l'instant.</p>
        )}

        {activeCategory?.actions.length > 0 && (
          <>
            <div className="tab-list action-tab-list">
              {activeCategory.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={action.id === activeActionId ? "selected" : ""}
                  disabled={!action.availability.ok}
                  onClick={() => setActiveActionId(action.id)}
                >
                  {action.label}
                </button>
              ))}
            </div>

            {activeAction && (
              <div className="action-detail">
                {activeAction.description && <p>{activeAction.description}</p>}
                {!activeAction.availability.ok && <p className="error">{activeAction.availability.reason}</p>}
                {activeAction.handlerId === "mission" ? (
                  <MissionPicker
                    character={character}
                    onStart={(payload) => onStart(activeAction.id, payload)}
                    submitting={submitting}
                    availabilityOk={activeAction.availability.ok}
                  />
                ) : activeAction.handlerId === "sEntrainer" ? (
                  <TalentPicker
                    character={character}
                    activeAction={activeAction}
                    onStart={(payload) => onStart(activeAction.id, payload)}
                    submitting={submitting}
                    availabilityOk={activeAction.availability.ok}
                  />
                ) : activeAction.handlerId === "apprentissage" ? (
                  <ProfessionPicker
                    activeAction={activeAction}
                    onStart={(payload) => onStart(activeAction.id, payload)}
                    submitting={submitting}
                    availabilityOk={activeAction.availability.ok}
                  />
                ) : (
                  <button
                    type="button"
                    disabled={submitting || !activeAction.availability.ok}
                    onClick={() => onStart(activeAction.id)}
                  >
                    Commencer
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
