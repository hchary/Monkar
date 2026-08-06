import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { salePrice } from "../../lib/salePrice";
import { RARITIES } from "../creator/TalentsManager";

function useOwnedInstances(characterId, ownerUid) {
  const [instances, setInstances] = useState([]);
  useEffect(() => {
    // Same two-filter requirement as InventoryTab.jsx/ActionBrowser.jsx's useInstanceTagIds -
    // firestore.rules authorizes instances reads on ownerUid, not characterId alone.
    const q = query(
      collection(db, "instances"),
      where("ownerUid", "==", ownerUid),
      where("characterId", "==", characterId)
    );
    return onSnapshot(q, (snap) => setInstances(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [characterId, ownerUid]);
  return instances;
}

function useObjects() {
  const [objects, setObjects] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "objects", "items"), (snap) => {
      setObjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);
  return objects;
}

// The player-facing side of the "Faire du commerce" action (docs/TODO.md "Intermède actions"):
// needs a payload (instanceId) before it can start, same reason TalentPicker.jsx/
// ProfessionPicker.jsx exist. Unlike those, this action never writes lastAction (it draws from the
// shared Intermède budget instead of the main action lock - see actionPipeline.js), so there is no
// result pop-up to show the sale's outcome: the confirmation is whatever performAction's own
// response echoes back (see ActionPanel.jsx's handleStart), shown inline here instead.
export default function CommercePicker({ character, onStart, submitting, availabilityOk }) {
  const instances = useOwnedInstances(character.id, character.ownerUid);
  const objects = useObjects();
  const [selectedId, setSelectedId] = useState(null);
  const [lastSale, setLastSale] = useState(null);

  const candidates = instances
    .map((instance) => ({ instance, object: objects.find((o) => o.id === instance.objectId) }))
    .filter(({ object }) => !!object);

  useEffect(() => {
    if (selectedId && !candidates.some(({ instance }) => instance.id === selectedId)) setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, selectedId]);

  async function handleSell() {
    setLastSale(null);
    const result = await onStart({ instanceId: selectedId });
    if (result?.response) {
      setLastSale(result.response);
      setSelectedId(null);
    }
  }

  return (
    <div className="commerce-picker">
      <fieldset className="action-loot-box">
        <legend>Objets à vendre</legend>
        {candidates.length === 0 ? (
          <p className="empty-state">Vous ne possédez aucun objet à vendre.</p>
        ) : (
          <ul className="talent-list">
            {candidates.map(({ instance, object }) => (
              <li key={instance.id}>
                <button
                  type="button"
                  className={instance.id === selectedId ? "selected" : ""}
                  onClick={() => setSelectedId(instance.id)}
                >
                  {object.name} ({RARITIES.find((r) => r.value === object.rarity)?.label || object.rarity}) —{" "}
                  {salePrice(object)} or
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {lastSale && (
        <p className="commerce-sale-result">
          Vendu : {lastSale.objectName} pour {lastSale.goldGained} or.
          {lastSale.mythicRumorTriggered && " La rumeur de cette vente se répand déjà."}
        </p>
      )}

      <button type="button" disabled={!selectedId || submitting || !availabilityOk} onClick={handleSell}>
        Vendre
      </button>
    </div>
  );
}
