import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, setDoc, writeBatch, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { matchesTag } from "./TagsManager";
import MultiSelectModalField from "./MultiSelectModalField";

export const RARITIES = [
  { value: "commun", label: "Commun" },
  { value: "peu_commun", label: "Peu commun" },
  { value: "rare", label: "Rare" },
  { value: "tres_rare", label: "Très rare" },
  { value: "legendaire", label: "Légendaire" },
  { value: "mythique", label: "Mythique" },
  { value: "divin", label: "Divin" },
  { value: "unique", label: "Unique" },
];

const emptyForm = {
  name: "",
  trainable: false,
  rarity: "commun",
  effect: "",
  favoredQuestIds: [],
  trainerTypeId: "",
  tagIds: [],
  ancestorIds: [],
  descendantIds: [],
};

// Matches a talent's name, effect text, or rarity — for use as MultiSelectModalField's matchesFilter.
export function matchesTalent(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (
    (option.name || "").toLowerCase().includes(q) ||
    (option.effect || "").toLowerCase().includes(q) ||
    (option.rarity || "").toLowerCase().includes(q)
  );
}

function useItems(collectionName) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", collectionName, "items"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [collectionName]);
  return items;
}

function MultiSelectField({ legend, options, selectedIds, onToggle, createLink }) {
  return (
    <fieldset>
      <legend>
        {legend}
        {createLink && (
          <Link to={createLink} target="_blank" rel="noopener noreferrer">
            {" "}
            Créer
          </Link>
        )}
      </legend>
      {options.length === 0 && <p>Aucun élément créé pour l'instant.</p>}
      {options.map((option) => (
        <label key={option.id}>
          <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => onToggle(option.id)} />
          {option.name}
        </label>
      ))}
    </fieldset>
  );
}

const emptyFilters = { rarities: [], trainableOnly: false, text: "" };

export default function TalentsManager() {
  const [talents, setTalents] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [panelOpen, setPanelOpen] = useState(false);

  const quests = useItems("quests");
  const trainerTypes = useItems("trainerTypes");
  const tags = useItems("tags");
  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const selectableTalents = talents
    .filter((talent) => talent.id !== editingId)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "talents", "items"), (snap) => {
      setTalents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredTalents = talents.filter((talent) => {
    if (filters.rarities.length > 0 && !filters.rarities.includes(talent.rarity || "commun")) return false;
    if (filters.trainableOnly && !talent.trainable) return false;
    const q = filters.text.toLowerCase();
    if (q && !((talent.name || "").toLowerCase().includes(q) || (talent.effect || "").toLowerCase().includes(q))) {
      return false;
    }
    return true;
  });

  function toggleRarityFilter(value) {
    setFilters((prev) => ({
      ...prev,
      rarities: prev.rarities.includes(value) ? prev.rarities.filter((r) => r !== value) : [...prev.rarities, value],
    }));
  }

  function startEdit(talent) {
    setEditingId(talent.id);
    setForm({
      name: talent.name || "",
      trainable: !!talent.trainable,
      rarity: talent.rarity || "commun",
      effect: talent.effect || "",
      favoredQuestIds: talent.favoredQuestIds || [],
      trainerTypeId: talent.trainerTypeId || "",
      tagIds: talent.tagIds || [],
      ancestorIds: talent.ancestorIds || [],
      descendantIds: talent.descendantIds || [],
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleQuest(questId) {
    setForm((prev) => ({
      ...prev,
      favoredQuestIds: prev.favoredQuestIds.includes(questId)
        ? prev.favoredQuestIds.filter((id) => id !== questId)
        : [...prev.favoredQuestIds, questId],
    }));
  }

  function toggleTagId(id) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((x) => x !== id) : [...prev.tagIds, id],
    }));
  }

  function toggleAncestorId(id) {
    setForm((prev) => ({
      ...prev,
      ancestorIds: prev.ancestorIds.includes(id) ? prev.ancestorIds.filter((x) => x !== id) : [...prev.ancestorIds, id],
    }));
  }

  function toggleDescendantId(id) {
    setForm((prev) => ({
      ...prev,
      descendantIds: prev.descendantIds.includes(id)
        ? prev.descendantIds.filter((x) => x !== id)
        : [...prev.descendantIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId ? doc(db, "worldData", "talents", "items", editingId) : doc(collection(db, "worldData", "talents", "items"));

    const previousTalent = editingId ? talents.find((t) => t.id === editingId) : null;
    const previousAncestorIds = previousTalent?.ancestorIds || [];
    const previousDescendantIds = previousTalent?.descendantIds || [];

    const addedAncestorIds = form.ancestorIds.filter((id) => !previousAncestorIds.includes(id));
    const removedAncestorIds = previousAncestorIds.filter((id) => !form.ancestorIds.includes(id));
    const addedDescendantIds = form.descendantIds.filter((id) => !previousDescendantIds.includes(id));
    const removedDescendantIds = previousDescendantIds.filter((id) => !form.descendantIds.includes(id));

    const batch = writeBatch(db);

    batch.set(ref, {
      name: form.name,
      trainable: form.trainable,
      rarity: form.rarity,
      effect: form.effect,
      favoredQuestIds: form.favoredQuestIds,
      trainerTypeId: form.trainable ? form.trainerTypeId : "",
      tagIds: form.tagIds,
      ancestorIds: form.ancestorIds,
      descendantIds: form.descendantIds,
    });

    // A talent added as ancestor gains this talent as a descendant, and vice versa (bidirectional link).
    for (const ancestorId of addedAncestorIds) {
      batch.update(doc(db, "worldData", "talents", "items", ancestorId), { descendantIds: arrayUnion(ref.id) });
    }
    for (const ancestorId of removedAncestorIds) {
      batch.update(doc(db, "worldData", "talents", "items", ancestorId), { descendantIds: arrayRemove(ref.id) });
    }
    for (const descendantId of addedDescendantIds) {
      batch.update(doc(db, "worldData", "talents", "items", descendantId), { ancestorIds: arrayUnion(ref.id) });
    }
    for (const descendantId of removedDescendantIds) {
      batch.update(doc(db, "worldData", "talents", "items", descendantId), { ancestorIds: arrayRemove(ref.id) });
    }

    await batch.commit();
    resetForm();
  }

  async function deleteTalent(talent) {
    const batch = writeBatch(db);
    for (const ancestorId of talent.ancestorIds || []) {
      batch.update(doc(db, "worldData", "talents", "items", ancestorId), { descendantIds: arrayRemove(talent.id) });
    }
    for (const descendantId of talent.descendantIds || []) {
      batch.update(doc(db, "worldData", "talents", "items", descendantId), { ancestorIds: arrayRemove(talent.id) });
    }
    batch.delete(doc(db, "worldData", "talents", "items", talent.id));
    await batch.commit();
  }

  return (
    <div className="creator-section">
      <h2>Talents</h2>

      <fieldset>
        <legend>Filtres</legend>
        <MultiSelectField
          legend="Raretés"
          options={RARITIES.map((r) => ({ id: r.value, name: r.label }))}
          selectedIds={filters.rarities}
          onToggle={toggleRarityFilter}
        />
        <label>
          <input
            type="checkbox"
            checked={filters.trainableOnly}
            onChange={(e) => setFilters({ ...filters, trainableOnly: e.target.checked })}
          />
          Entraînable uniquement
        </label>
        <input
          placeholder="Rechercher par nom ou effet..."
          value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })}
        />
        <button type="button" onClick={() => setFilters(emptyFilters)}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      {RARITIES.map((r) => {
        const talentsForRarity = filteredTalents
          .filter((talent) => (talent.rarity || "commun") === r.value)
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

        if (talentsForRarity.length === 0) return null;

        return (
          <details key={r.value} className="collapsible-group">
            <summary>
              {r.label} ({talentsForRarity.length})
            </summary>
            <ul className="creator-list">
              {talentsForRarity.map((talent) => (
                <li key={talent.id}>
                  <strong>{talent.name}</strong>
                  {talent.trainable && "*"} — {talent.effect}
                  {(talent.favoredQuestIds || []).length > 0 && (
                    <div>
                      Quêtes favorisées :{" "}
                      {talent.favoredQuestIds
                        .map((id) => quests.find((q) => q.id === id)?.name || id)
                        .join(", ")}
                    </div>
                  )}
                  {talent.trainable && talent.trainerTypeId && (
                    <div>
                      Entraîneur : {trainerTypes.find((t) => t.id === talent.trainerTypeId)?.name || talent.trainerTypeId}
                    </div>
                  )}
                  {(talent.tagIds || []).length > 0 && (
                    <div>
                      Tags : {talent.tagIds.map((id) => tags.find((t) => t.id === id)?.name || id).join(", ")}
                    </div>
                  )}
                  {(talent.ancestorIds || []).length > 0 && (
                    <div>
                      Talents ancêtres :{" "}
                      {talent.ancestorIds.map((id) => talents.find((t) => t.id === id)?.name || id).join(", ")}
                    </div>
                  )}
                  {(talent.descendantIds || []).length > 0 && (
                    <div>
                      Talents descendants :{" "}
                      {talent.descendantIds.map((id) => talents.find((t) => t.id === id)?.name || id).join(", ")}
                    </div>
                  )}
                  <button type="button" onClick={() => startEdit(talent)}>
                    Modifier
                  </button>
                  <button type="button" onClick={() => deleteTalent(talent)}>
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}

      <details
        className="collapsible-group"
        open={panelOpen}
        onToggle={(e) => {
          if (e.target === e.currentTarget) setPanelOpen(e.target.open);
        }}
      >
        <summary>{editingId ? "Modifier le talent" : "Nouveau talent"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea
            placeholder="Effet (affiché dans l'infobulle)"
            value={form.effect}
            onChange={(e) => setForm({ ...form, effect: e.target.value })}
          />
          <label>
            Rareté
            <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })}>
              {RARITIES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.trainable}
              onChange={(e) => setForm({ ...form, trainable: e.target.checked })}
            />
            Entraînable
          </label>

          <MultiSelectField
            legend="Quêtes favorisées"
            options={quests}
            selectedIds={form.favoredQuestIds}
            onToggle={toggleQuest}
            createLink={`/creator?section=${encodeURIComponent("Quêtes")}`}
          />

          <MultiSelectModalField
            legend="Tags"
            options={sortedTags}
            selectedIds={form.tagIds}
            onToggle={toggleTagId}
            createLink={`/creator?section=${encodeURIComponent("Tag")}`}
            matchesFilter={matchesTag}
            filterPlaceholder="Filtrer par nom..."
            buttonLabel="Ajouter tags"
          />
          <p>
            Ces tags décident quelles quêtes peuvent faire progresser le talent, et quelles phrases-verbes le
            récit de quête peut employer quand il progresse. Le nom du tag doit être orthographié exactement
            comme dans le champ « Tags » des phrases-verbes (onglet « Génération de texte »).
          </p>

          <MultiSelectModalField
            legend="Talents ancêtres"
            options={selectableTalents}
            selectedIds={form.ancestorIds}
            onToggle={toggleAncestorId}
            matchesFilter={matchesTalent}
            filterPlaceholder="Filtrer par nom, effet ou rareté..."
            buttonLabel="Ajouter ancêtres"
          />

          <MultiSelectModalField
            legend="Talents descendants"
            options={selectableTalents}
            selectedIds={form.descendantIds}
            onToggle={toggleDescendantId}
            matchesFilter={matchesTalent}
            filterPlaceholder="Filtrer par nom, effet ou rareté..."
            buttonLabel="Ajouter descendants"
          />

          {form.trainable && (
            <fieldset>
              <legend>
                Entraîneur requis
                <Link to={`/creator?section=${encodeURIComponent("Types d'entraîneur")}`} target="_blank" rel="noopener noreferrer">
                  {" "}
                  Créer
                </Link>
              </legend>
              <label>
                Type d'entraîneur
                <select
                  value={form.trainerTypeId}
                  onChange={(e) => setForm({ ...form, trainerTypeId: e.target.value })}
                >
                  <option value="">(aucun)</option>
                  {trainerTypes.map((trainerType) => (
                    <option key={trainerType.id} value={trainerType.id}>
                      {trainerType.name}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          )}

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer le talent"}</button>
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
