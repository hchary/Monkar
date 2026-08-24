import { useEffect, useMemo, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { matchesTag } from "./TagsManager";
import { matchesObject } from "./ObjectsManager";
import { matchesTalent } from "./TalentsManager";
import { DIFFICULTIES } from "../../lib/difficulties";
import { AREA_TYPES, areaTypeLabel } from "../../../shared/lib/areaTypes";
import { DEFAULTS } from "../../../shared/schema/monster";
import { indexMonstersById, monsterChain, resolveInheritedFrom, selfAndDescendantIds } from "../../lib/monsters";
import MultiSelectModalField from "./MultiSelectModalField";
import SoloSelectModalField from "./SoloSelectModalField";

// `trigger` has no control here, exactly as it had none on the retired MissionSubjectsManager: it
// is authored by script (docs/TODO.md "Content migration scripts" carries it over verbatim). The
// form still round-trips whatever the document holds, since saving rewrites the whole document.
const emptyForm = { name: "", difficulty: DIFFICULTIES[0].value, ...DEFAULTS };

// Matches a monster's name, difficulty or area type — for use as SoloSelectModalField's
// matchesFilter, and as this manager's own free-text search.
export function matchesMonster(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (
    (option.name || "").toLowerCase().includes(q) ||
    (option.difficulty || "").toLowerCase().includes(q) ||
    (option.areaType || "").toLowerCase().includes(q)
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

function labelOf(items, id, fallback = id) {
  return items.find((item) => item.id === id)?.name || fallback;
}

function namesOf(items, ids) {
  return ids.map((id) => labelOf(items, id)).join(", ");
}

function difficultyLabel(value) {
  return DIFFICULTIES.find((d) => d.value === value)?.label || value;
}

// Read-only view of what the parent chain contributes: the tags, loot and taught talent an author
// would otherwise have to open every ancestor to see. Mirrors resolveMonster's rules - arrays
// concatenate, scalars are overridden by the monster's own value whenever it sets one.
function InheritedPanel({ parentId, form, monstersById, tags, objects, talents }) {
  if (!parentId) {
    return (
      <fieldset>
        <legend>Hérité du parent</legend>
        <p>Aucun parent : ce monstre ne porte que ses propres valeurs.</p>
      </fieldset>
    );
  }

  const inherited = resolveInheritedFrom(parentId, monstersById);
  const chain = monsterChain(monstersById[parentId], monstersById);

  return (
    <fieldset>
      <legend>Hérité du parent</legend>
      <p>Chaîne : {chain.map((monster) => monster.name || monster.id).join(" ← ") || "parent introuvable"}</p>
      <p>
        Type de zone : {inherited.areaType ? areaTypeLabel(inherited.areaType) : "aucun"}
        {form.areaType ? " (remplacé par le type choisi ci-dessus)" : " (utilisé)"}
      </p>
      <p>Tags : {inherited.tagIds.length > 0 ? namesOf(tags, inherited.tagIds) : "aucun"}</p>
      <p>Butin : {inherited.lootItemIds.length > 0 ? namesOf(objects, inherited.lootItemIds) : "aucun"}</p>
      <p>
        Talent enseigné : {inherited.talentRewardId ? labelOf(talents, inherited.talentRewardId) : "aucun"}
        {form.talentRewardId ? " (remplacé par le talent choisi ci-dessus)" : ""}
      </p>
    </fieldset>
  );
}

export default function MonstersManager() {
  const [monsters, setMonsters] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const tags = useItems("tags");
  const objects = useItems("objects");
  const talents = useItems("talents");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "monsters", "items"), (snap) => {
      setMonsters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const monstersById = useMemo(() => indexMonstersById(monsters), [monsters]);
  // A monster can descend from neither itself nor its own descendants: the picker never offers them.
  const excludedParentIds = useMemo(() => selfAndDescendantIds(editingId, monsters), [editingId, monsters]);
  const parentOptions = monsters.filter((monster) => !excludedParentIds.has(monster.id));
  const filtered = monsters.filter((monster) => matchesMonster(monster, filterText));

  function startEdit(monster) {
    setEditingId(monster.id);
    setForm({
      name: monster.name || "",
      difficulty: monster.difficulty || DIFFICULTIES[0].value,
      areaType: monster.areaType ?? null,
      parentId: monster.parentId ?? null,
      tagIds: monster.tagIds || [],
      lootItemIds: monster.lootItemIds || [],
      talentRewardId: monster.talentRewardId ?? null,
      trigger: monster.trigger ?? null,
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
      ? doc(db, "worldData", "monsters", "items", editingId)
      : doc(collection(db, "worldData", "monsters", "items"));

    await setDoc(ref, {
      name: form.name,
      difficulty: form.difficulty,
      areaType: form.areaType || null,
      parentId: form.parentId || null,
      tagIds: form.tagIds,
      lootItemIds: form.lootItemIds,
      talentRewardId: form.talentRewardId || null,
      trigger: form.trigger ?? null,
    });
    resetForm();
  }

  function toggleIn(field, id) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));
  }

  return (
    <div className="creator-section">
      <h2>Monstres</h2>
      <p>
        Le bestiaire : la cible d'une mission générée. Un monstre porte le type de zone où il peut être
        rencontré, sa difficulté (qui plafonne la rareté de son butin), ses tags, son butin et le talent
        qu'il enseigne. Il hérite de son parent : les listes s'additionnent, les valeurs simples sont
        reprises tant qu'elles ne sont pas renseignées ici.
      </p>

      <fieldset>
        <legend>Filtres</legend>
        <input
          placeholder="Rechercher par nom, difficulté ou type de zone..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button type="button" onClick={() => setFilterText("")}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filtered.map((monster) => (
          <li key={monster.id}>
            <strong>{monster.name}</strong> — {difficultyLabel(monster.difficulty)}
            {" · "}
            {monster.areaType ? areaTypeLabel(monster.areaType) : "type de zone hérité"}
            {monster.parentId ? ` · enfant de ${labelOf(monsters, monster.parentId, "parent introuvable")}` : ""}
            <button type="button" onClick={() => startEdit(monster)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "monsters", "items", monster.id))}>
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
        <summary>{editingId ? "Modifier le monstre" : "Nouveau monstre"}</summary>
        <form onSubmit={handleSubmit}>
          <input
            placeholder='Nom (ex: "dragon", "dragon ancien")'
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <label>
            Difficulté
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty.value} value={difficulty.value}>
                  {difficulty.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Type de zone
            <select value={form.areaType || ""} onChange={(e) => setForm({ ...form, areaType: e.target.value || null })}>
              <option value="">Hériter du parent</option>
              {AREA_TYPES.map((areaType) => (
                <option key={areaType.value} value={areaType.value}>
                  {areaType.label}
                </option>
              ))}
            </select>
          </label>

          <SoloSelectModalField
            legend="Parent"
            options={parentOptions}
            selectedId={form.parentId}
            onSelect={(id) => setForm({ ...form, parentId: id })}
            onClear={() => setForm({ ...form, parentId: null })}
            matchesFilter={matchesMonster}
            filterPlaceholder="Filtrer par nom, difficulté ou type de zone..."
            buttonLabel="Choisir un parent"
          />

          <MultiSelectModalField
            legend="Tags"
            options={tags}
            selectedIds={form.tagIds}
            onToggle={(id) => toggleIn("tagIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Tag")}`}
            matchesFilter={matchesTag}
            filterPlaceholder="Filtrer par nom..."
            buttonLabel="Ajouter tags"
          />

          <MultiSelectModalField
            legend="Butin"
            options={objects}
            selectedIds={form.lootItemIds}
            onToggle={(id) => toggleIn("lootItemIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Objets")}`}
            matchesFilter={matchesObject}
            filterPlaceholder="Filtrer par nom, description, rareté ou type..."
            buttonLabel="Ajouter des objets"
          />

          <SoloSelectModalField
            legend="Talent enseigné"
            options={talents}
            selectedId={form.talentRewardId}
            onSelect={(id) => setForm({ ...form, talentRewardId: id })}
            onClear={() => setForm({ ...form, talentRewardId: null })}
            createLink={`/creator?section=${encodeURIComponent("Talents")}`}
            matchesFilter={matchesTalent}
            filterPlaceholder="Filtrer par nom, effet ou rareté..."
            buttonLabel="Choisir un talent"
          />

          <InheritedPanel
            parentId={form.parentId}
            form={form}
            monstersById={monstersById}
            tags={tags}
            objects={objects}
            talents={talents}
          />

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer le monstre"}</button>
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
