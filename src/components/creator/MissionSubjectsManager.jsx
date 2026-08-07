import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { matchesTag } from "./TagsManager";
import { DIFFICULTIES } from "../../lib/difficulties";
import MultiSelectModalField from "./MultiSelectModalField";

// Mirrors MissionActionsManager.jsx's own list - kept in sync by hand, same convention as every
// other free-text `type` pairing in this catalog pair.
const SEEDED_TYPES = ["ennemis", "livraison", "tresor", "protection"];

const emptyForm = { name: "", type: "", climateIds: [], difficultyTiers: [], variations: [] };

// Matches a mission subject's name or type - for use as MultiSelectModalField's matchesFilter, and
// as this manager's own free-text search.
export function matchesMissionSubject(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (option.name || "").toLowerCase().includes(q) || (option.type || "").toLowerCase().includes(q);
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

// One row of `difficultyTiers` - prefix/suffix/tagIds authored for a single DIFFICULTIES tier.
function DifficultyTierRow({ tier, index, onFieldChange, onRemove, tags }) {
  return (
    <fieldset className="condition-row">
      <legend>
        <select value={tier.difficulty} onChange={(e) => onFieldChange(index, { difficulty: e.target.value })}>
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => onRemove(index)}>
          Supprimer
        </button>
      </legend>
      <label>
        Préfixe
        <input
          placeholder='ex: "jeune"'
          value={tier.prefix || ""}
          onChange={(e) => onFieldChange(index, { prefix: e.target.value || null })}
        />
      </label>
      <label>
        Suffixe
        <input
          placeholder='ex: "liche"'
          value={tier.suffix || ""}
          onChange={(e) => onFieldChange(index, { suffix: e.target.value || null })}
        />
      </label>
      <MultiSelectModalField
        legend="Tags"
        options={tags}
        selectedIds={tier.tagIds || []}
        onToggle={(id) =>
          onFieldChange(index, {
            tagIds: (tier.tagIds || []).includes(id)
              ? tier.tagIds.filter((x) => x !== id)
              : [...(tier.tagIds || []), id],
          })
        }
        createLink={`/creator?section=${encodeURIComponent("Tag")}`}
        matchesFilter={matchesTag}
        filterPlaceholder="Filtrer par nom..."
        buttonLabel="Ajouter tags"
      />
    </fieldset>
  );
}

// One row of `variations` - a difficulty-independent flavor modifier.
function VariationRow({ variation, index, onFieldChange, onRemove, tags }) {
  return (
    <fieldset className="condition-row">
      <legend>
        Variation
        <button type="button" onClick={() => onRemove(index)}>
          Supprimer
        </button>
      </legend>
      <label>
        Préfixe
        <input
          placeholder='ex: "ancien"'
          value={variation.prefix || ""}
          onChange={(e) => onFieldChange(index, { prefix: e.target.value || null })}
        />
      </label>
      <label>
        Suffixe
        <input
          placeholder='ex: "rouge"'
          value={variation.suffix || ""}
          onChange={(e) => onFieldChange(index, { suffix: e.target.value || null })}
        />
      </label>
      <MultiSelectModalField
        legend="Tags"
        options={tags}
        selectedIds={variation.tagIds || []}
        onToggle={(id) =>
          onFieldChange(index, {
            tagIds: (variation.tagIds || []).includes(id)
              ? variation.tagIds.filter((x) => x !== id)
              : [...(variation.tagIds || []), id],
          })
        }
        createLink={`/creator?section=${encodeURIComponent("Tag")}`}
        matchesFilter={matchesTag}
        filterPlaceholder="Filtrer par nom..."
        buttonLabel="Ajouter tags"
      />
    </fieldset>
  );
}

export default function MissionSubjectsManager() {
  const [missionSubjects, setMissionSubjects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const tags = useItems("tags");
  const climats = useItems("climats");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "missionSubjects", "items"), (snap) => {
      setMissionSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const knownTypes = [...new Set([...SEEDED_TYPES, ...missionSubjects.map((s) => s.type).filter(Boolean)])];
  const filtered = missionSubjects.filter((subject) => matchesMissionSubject(subject, filterText));

  function startEdit(missionSubject) {
    setEditingId(missionSubject.id);
    setForm({
      name: missionSubject.name || "",
      type: missionSubject.type || "",
      climateIds: missionSubject.climateIds || [],
      difficultyTiers: missionSubject.difficultyTiers || [],
      variations: missionSubject.variations || [],
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "missionSubjects", "items", editingId)
      : doc(collection(db, "worldData", "missionSubjects", "items"));

    await setDoc(ref, {
      name: form.name,
      type: form.type,
      climateIds: form.climateIds,
      difficultyTiers: form.difficultyTiers,
      variations: form.variations,
    });
    resetForm();
  }

  function toggleClimateId(id) {
    setForm((prev) => ({
      ...prev,
      climateIds: prev.climateIds.includes(id) ? prev.climateIds.filter((x) => x !== id) : [...prev.climateIds, id],
    }));
  }

  function addDifficultyTier() {
    setForm((prev) => ({
      ...prev,
      difficultyTiers: [...prev.difficultyTiers, { difficulty: DIFFICULTIES[0].value, prefix: null, suffix: null, tagIds: [] }],
    }));
  }

  function removeDifficultyTier(index) {
    setForm((prev) => ({ ...prev, difficultyTiers: prev.difficultyTiers.filter((_, i) => i !== index) }));
  }

  function updateDifficultyTier(index, patch) {
    setForm((prev) => ({
      ...prev,
      difficultyTiers: prev.difficultyTiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    }));
  }

  function addVariation() {
    setForm((prev) => ({ ...prev, variations: [...prev.variations, { prefix: null, suffix: null, tagIds: [] }] }));
  }

  function removeVariation(index) {
    setForm((prev) => ({ ...prev, variations: prev.variations.filter((_, i) => i !== index) }));
  }

  function updateVariation(index, patch) {
    setForm((prev) => ({
      ...prev,
      variations: prev.variations.map((variation, i) => (i === index ? { ...variation, ...patch } : variation)),
    }));
  }

  return (
    <div className="creator-section">
      <h2>Sujets de mission</h2>
      <p>
        Un sujet de mission est la seconde moitié du nom d'une mission générée (ex. "dragon", "caravane marchande"),
        associé à une action de mission partageant le même type.
      </p>

      <fieldset>
        <legend>Filtres</legend>
        <input
          placeholder="Rechercher par nom ou type..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button type="button" onClick={() => setFilterText("")}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filtered.map((missionSubject) => (
          <li key={missionSubject.id}>
            <strong>{missionSubject.name}</strong> — {missionSubject.type}
            <button type="button" onClick={() => startEdit(missionSubject)}>
              Modifier
            </button>
            <button
              type="button"
              onClick={() => deleteDoc(doc(db, "worldData", "missionSubjects", "items", missionSubject.id))}
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
        <summary>{editingId ? "Modifier le sujet de mission" : "Nouveau sujet de mission"}</summary>
        <form onSubmit={handleSubmit}>
          <input
            placeholder='Nom (ex: "dragon", "caravane marchande")'
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            list="mission-subject-types"
            placeholder="Type (ex: ennemis, livraison...)"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            required
          />
          <datalist id="mission-subject-types">
            {knownTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>

          <MultiSelectModalField
            legend="Climats"
            options={climats}
            selectedIds={form.climateIds}
            onToggle={toggleClimateId}
            createLink={`/creator?section=${encodeURIComponent("Climat")}`}
            filterPlaceholder="Filtrer par nom..."
            buttonLabel="Ajouter climats"
          />

          <fieldset>
            <legend>Paliers de difficulté</legend>
            {form.difficultyTiers.length === 0 && (
              <p>Aucun palier — ce sujet ne peut être tiré à aucune difficulté.</p>
            )}
            {form.difficultyTiers.map((tier, index) => (
              <DifficultyTierRow
                key={index}
                tier={tier}
                index={index}
                onFieldChange={updateDifficultyTier}
                onRemove={removeDifficultyTier}
                tags={tags}
              />
            ))}
            <button type="button" onClick={addDifficultyTier}>
              Ajouter un palier de difficulté
            </button>
          </fieldset>

          <fieldset>
            <legend>Variations</legend>
            {form.variations.length === 0 && <p>Aucune variation.</p>}
            {form.variations.map((variation, index) => (
              <VariationRow
                key={index}
                variation={variation}
                index={index}
                onFieldChange={updateVariation}
                onRemove={removeVariation}
                tags={tags}
              />
            ))}
            <button type="button" onClick={addVariation}>
              Ajouter une variation
            </button>
          </fieldset>

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer le sujet de mission"}</button>
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
