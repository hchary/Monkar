import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

// Seeded starting values (docs/TODO.md "Mission subject and action catalog") - `type` stays plain
// free text, not a hardcoded enum, so a content author can grow past this list by simply typing an
// unseen value; this is only a convenience suggestion list.
const SEEDED_TYPES = ["ennemis", "livraison", "tresor", "protection"];

const emptyForm = { phrase: "", type: "" };

// Matches a mission action's phrase or type - for use as MultiSelectModalField's matchesFilter,
// and as this manager's own free-text search.
export function matchesMissionAction(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (option.phrase || "").toLowerCase().includes(q) || (option.type || "").toLowerCase().includes(q);
}

export default function MissionActionsManager() {
  const [missionActions, setMissionActions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "missionActions", "items"), (snap) => {
      setMissionActions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const knownTypes = [...new Set([...SEEDED_TYPES, ...missionActions.map((a) => a.type).filter(Boolean)])];
  const filtered = missionActions.filter((action) => matchesMissionAction(action, filterText));

  function startEdit(missionAction) {
    setEditingId(missionAction.id);
    setForm({ phrase: missionAction.phrase || "", type: missionAction.type || "" });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "missionActions", "items", editingId)
      : doc(collection(db, "worldData", "missionActions", "items"));

    await setDoc(ref, { phrase: form.phrase, type: form.type });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Actions de mission</h2>
      <p>
        Une action de mission est la première moitié du nom d'une mission générée (ex. "Vaincre", "Protéger",
        "Enquêter sur"), associée à un sujet de mission partageant le même type.
      </p>

      <fieldset>
        <legend>Filtres</legend>
        <input
          placeholder="Rechercher par phrase ou type..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button type="button" onClick={() => setFilterText("")}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filtered.map((missionAction) => (
          <li key={missionAction.id}>
            <strong>{missionAction.phrase}</strong> — {missionAction.type}
            <button type="button" onClick={() => startEdit(missionAction)}>
              Modifier
            </button>
            <button
              type="button"
              onClick={() => deleteDoc(doc(db, "worldData", "missionActions", "items", missionAction.id))}
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <details
        className="collapsible-group"
        open={panelOpen}
        onToggle={(e) => {
          if (e.target === e.currentTarget) setPanelOpen(e.target.open);
        }}
      >
        <summary>{editingId ? "Modifier l'action de mission" : "Nouvelle action de mission"}</summary>
        <form onSubmit={handleSubmit}>
          <input
            placeholder='Phrase (ex: "Vaincre", "Enquêter sur")'
            value={form.phrase}
            onChange={(e) => setForm({ ...form, phrase: e.target.value })}
            required
          />
          <input
            list="mission-action-types"
            placeholder="Type (ex: ennemis, livraison...)"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            required
          />
          <datalist id="mission-action-types">
            {knownTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer l'action de mission"}</button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                Annuler
              </button>
            )}
          </div>
        </form>
      </details>
    </div>
  );
}
