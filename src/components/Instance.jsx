import { RARITIES } from "./creator/TalentsManager";
import { OBJECT_TYPES } from "./creator/ObjectsManager";

// Per-copy condition of an Instance — distinct from the object's rarity/type, which are
// catalog-level (worldData/objects/items) and shared by every instance of that object.
export const CONDITIONS = [
  { value: "neuf", label: "Neuf" },
  { value: "use", label: "Usé" },
  { value: "endommage", label: "Endommagé" },
  { value: "casse", label: "Cassé" },
];

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// An Instance is an Object (worldData/objects/items) owned by a character: the catalog data
// (name, rarity, type, tags) plus per-copy particulars (acquisition date, condition, owner).
// Displayed under the object's name — "Instance" stays a technical term, never shown to players.
export default function InstanceCard({ instance, object, tags }) {
  if (!object) return null;
  const rarityLabel = RARITIES.find((r) => r.value === object.rarity)?.label || object.rarity;
  const typeLabel = OBJECT_TYPES.find((t) => t.value === object.type)?.label || object.type;
  const conditionLabel = CONDITIONS.find((c) => c.value === instance.condition)?.label || instance.condition;

  return (
    <li className={`instance-card rarity-${object.rarity}`}>
      <strong>{object.name}</strong> — {rarityLabel} — {typeLabel}
      <div>État : {conditionLabel}</div>
      <div>Obtenu le {formatDate(instance.acquisitionDate)}</div>
      {(instance.description || object.description) && <div>{instance.description || object.description}</div>}
      <div>
        Tags : {(object.tagIds || []).map((id) => tags.find((t) => t.id === id)?.name || id).join(", ") || "aucun"}
      </div>
    </li>
  );
}
