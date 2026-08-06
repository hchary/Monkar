import { useEffect, useRef, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot, getDocs, query, where, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

// Matches a tag's name — for use as MultiSelectModalField's matchesFilter (e.g. QuestsManager's tagIds).
export function matchesTag(option, search) {
  const q = search.toLowerCase();
  return !q || (option.name || "").toLowerCase().includes(q);
}

export default function TagsManager() {
  const [tags, setTags] = useState([]);
  const [newName, setNewName] = useState("");
  const [filterText, setFilterText] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [editName, setEditName] = useState("");
  const dialogRef = useRef(null);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "tags", "items"), (snap) => {
      setTags(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const filteredTags = sortedTags.filter((tag) => matchesTag(tag, filterText));

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await setDoc(doc(collection(db, "worldData", "tags", "items")), { name });
    setNewName("");
  }

  function openTag(tag) {
    setSelectedTag(tag);
    setEditName(tag.name || "");
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setSelectedTag(null);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    const name = editName.trim();
    if (!name || !selectedTag) return;
    await setDoc(doc(db, "worldData", "tags", "items", selectedTag.id), { name });
    closeDialog();
  }

  async function handleDelete() {
    if (!selectedTag) return;
    const referencingQuests = await getDocs(
      query(collection(db, "worldData", "quests", "items"), where("tagIds", "array-contains", selectedTag.id))
    );
    const referencingSubjects = await getDocs(
      query(collection(db, "worldData", "narrativeSubjects", "items"), where("tagIds", "array-contains", selectedTag.id))
    );
    const referencingObjects = await getDocs(
      query(collection(db, "worldData", "objects", "items"), where("tagIds", "array-contains", selectedTag.id))
    );
    const referencingLootTables = await getDocs(
      query(collection(db, "worldData", "lootTables", "items"), where("tagIds", "array-contains", selectedTag.id))
    );
    const referencingTalents = await getDocs(
      query(collection(db, "worldData", "talents", "items"), where("tagIds", "array-contains", selectedTag.id))
    );
    const referencingVerbPhrases = await getDocs(
      query(collection(db, "worldData", "verbPhrases", "items"), where("tagIds", "array-contains", selectedTag.id))
    );
    const referencingRecettesByTag = await getDocs(
      query(collection(db, "worldData", "recettes", "items"), where("tagIds", "array-contains", selectedTag.id))
    );
    const referencingRecettesByCategory = await getDocs(
      query(collection(db, "worldData", "recettes", "items"), where("categoryIds", "array-contains", selectedTag.id))
    );
    await Promise.all([
      ...referencingQuests.docs.map((questDoc) =>
        updateDoc(questDoc.ref, { tagIds: (questDoc.data().tagIds || []).filter((id) => id !== selectedTag.id) })
      ),
      ...referencingSubjects.docs.map((subjectDoc) =>
        updateDoc(subjectDoc.ref, { tagIds: (subjectDoc.data().tagIds || []).filter((id) => id !== selectedTag.id) })
      ),
      ...referencingObjects.docs.map((objectDoc) =>
        updateDoc(objectDoc.ref, { tagIds: (objectDoc.data().tagIds || []).filter((id) => id !== selectedTag.id) })
      ),
      ...referencingLootTables.docs.map((tableDoc) =>
        updateDoc(tableDoc.ref, { tagIds: (tableDoc.data().tagIds || []).filter((id) => id !== selectedTag.id) })
      ),
      ...referencingTalents.docs.map((talentDoc) =>
        updateDoc(talentDoc.ref, { tagIds: (talentDoc.data().tagIds || []).filter((id) => id !== selectedTag.id) })
      ),
      ...referencingVerbPhrases.docs.map((verbPhraseDoc) =>
        updateDoc(verbPhraseDoc.ref, {
          tagIds: (verbPhraseDoc.data().tagIds || []).filter((id) => id !== selectedTag.id),
        })
      ),
      ...referencingRecettesByTag.docs.map((recetteDoc) =>
        updateDoc(recetteDoc.ref, { tagIds: (recetteDoc.data().tagIds || []).filter((id) => id !== selectedTag.id) })
      ),
      ...referencingRecettesByCategory.docs.map((recetteDoc) =>
        updateDoc(recetteDoc.ref, {
          categoryIds: (recetteDoc.data().categoryIds || []).filter((id) => id !== selectedTag.id),
        })
      ),
    ]);
    await deleteDoc(doc(db, "worldData", "tags", "items", selectedTag.id));
    closeDialog();
  }

  return (
    <div className="creator-section">
      <h2>Tags</h2>

      <div className="tag-toolbar">
        <form className="tag-create-form" onSubmit={handleCreate}>
          <input placeholder="Nouveau tag" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <button type="submit">Confirmer</button>
        </form>
        <input
          type="search"
          className="tag-filter-input"
          placeholder="Rechercher par nom..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      <details className="collapsible-group" open>
        <summary>
          Tags ({filteredTags.length}
          {filteredTags.length !== sortedTags.length ? ` / ${sortedTags.length}` : ""})
        </summary>
        <ul className="creator-list">
          {filteredTags.length === 0 && <li className="empty-state">Aucun tag.</li>}
          {filteredTags.map((tag) => (
            <li key={tag.id}>
              <button type="button" className="tag-list-item" onClick={() => openTag(tag)}>
                {tag.name}
              </button>
            </li>
          ))}
        </ul>
      </details>

      <dialog
        ref={dialogRef}
        className="tag-edit-dialog"
        onClick={(e) => {
          if (e.target === dialogRef.current) closeDialog();
        }}
        onClose={() => setSelectedTag(null)}
      >
        <form className="tag-edit-content" onSubmit={handleUpdate}>
          <h4>Modifier le tag</h4>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <div className="tag-edit-actions">
            <button type="submit">Confirmer</button>
            <button type="button" onClick={handleDelete}>
              Supprimer
            </button>
            <button type="button" onClick={closeDialog}>
              Annuler
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
