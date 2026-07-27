import { useEffect, useRef, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function TagsManager() {
  const [tags, setTags] = useState([]);
  const [newName, setNewName] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [editName, setEditName] = useState("");
  const dialogRef = useRef(null);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "tags", "items"), (snap) => {
      setTags(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

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
    await deleteDoc(doc(db, "worldData", "tags", "items", selectedTag.id));
    closeDialog();
  }

  return (
    <div className="creator-section">
      <h2>Tags</h2>

      <form className="tag-create-form" onSubmit={handleCreate}>
        <input placeholder="Nouveau tag" value={newName} onChange={(e) => setNewName(e.target.value)} required />
        <button type="submit">Confirmer</button>
      </form>

      <details className="collapsible-group" open>
        <summary>Tags ({sortedTags.length})</summary>
        <ul className="creator-list">
          {sortedTags.length === 0 && <li className="empty-state">Aucun tag.</li>}
          {sortedTags.map((tag) => (
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
