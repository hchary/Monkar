import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

const creatorBase = import.meta.env.BASE_URL;

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
  favoredQuestTypeIds: [],
  trainerTypeId: "",
};

export default function TalentsManager() {
  const [talents, setTalents] = useState([]);
  const [questTypes, setQuestTypes] = useState([]);
  const [trainerTypes, setTrainerTypes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "talents", "items"), (snap) => {
      setTalents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "questTypes", "items"), (snap) => {
      setQuestTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "trainerTypes", "items"), (snap) => {
      setTrainerTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(talent) {
    setEditingId(talent.id);
    setForm({
      name: talent.name || "",
      trainable: !!talent.trainable,
      rarity: talent.rarity || "commun",
      effect: talent.effect || "",
      favoredQuestTypeIds: talent.favoredQuestTypeIds || [],
      trainerTypeId: talent.trainerTypeId || "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleQuestType(questTypeId) {
    setForm((prev) => ({
      ...prev,
      favoredQuestTypeIds: prev.favoredQuestTypeIds.includes(questTypeId)
        ? prev.favoredQuestTypeIds.filter((id) => id !== questTypeId)
        : [...prev.favoredQuestTypeIds, questTypeId],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId ? doc(db, "worldData", "talents", "items", editingId) : doc(collection(db, "worldData", "talents", "items"));

    await setDoc(ref, {
      name: form.name,
      trainable: form.trainable,
      rarity: form.rarity,
      effect: form.effect,
      favoredQuestTypeIds: form.favoredQuestTypeIds,
      trainerTypeId: form.trainable ? form.trainerTypeId : "",
    });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Talents</h2>

      {RARITIES.map((r) => {
        const talentsForRarity = talents
          .filter((talent) => (talent.rarity || "commun") === r.value)
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

        if (talentsForRarity.length === 0) return null;

        return (
          <details key={r.value} className="rarity-group">
            <summary>
              {r.label} ({talentsForRarity.length})
            </summary>
            <ul className="creator-list">
              {talentsForRarity.map((talent) => (
                <li key={talent.id}>
                  <strong>{talent.name}</strong>
                  {talent.trainable && "*"} — {talent.effect}
                  {(talent.favoredQuestTypeIds || []).length > 0 && (
                    <div>
                      Quêtes favorisées :{" "}
                      {talent.favoredQuestTypeIds
                        .map((id) => questTypes.find((qt) => qt.id === id)?.name || id)
                        .join(", ")}
                    </div>
                  )}
                  {talent.trainable && talent.trainerTypeId && (
                    <div>
                      Entraîneur : {trainerTypes.find((t) => t.id === talent.trainerTypeId)?.name || talent.trainerTypeId}
                    </div>
                  )}
                  <button type="button" onClick={() => startEdit(talent)}>
                    Modifier
                  </button>
                  <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "talents", "items", talent.id))}>
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}

      <h3>{editingId ? "Modifier le talent" : "Nouveau talent"}</h3>
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

        <fieldset>
          <legend>
            Types de quête favorisés{" "}
            <a href={`${creatorBase}creator?section=${encodeURIComponent("Types de quête")}`} target="_blank" rel="noopener noreferrer">
              (créer un type de quête)
            </a>
          </legend>
          {questTypes.length === 0 && <span>Aucun type de quête créé pour l'instant.</span>}
          {questTypes.map((questType) => (
            <label key={questType.id}>
              <input
                type="checkbox"
                checked={form.favoredQuestTypeIds.includes(questType.id)}
                onChange={() => toggleQuestType(questType.id)}
              />
              {questType.name}
            </label>
          ))}
        </fieldset>

        {form.trainable && (
          <fieldset>
            <legend>
              Entraîneur requis{" "}
              <a href={`${creatorBase}creator?section=${encodeURIComponent("Types d'entraîneur")}`} target="_blank" rel="noopener noreferrer">
                (créer un type d'entraîneur)
              </a>
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
    </div>
  );
}
