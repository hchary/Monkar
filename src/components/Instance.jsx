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

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// A grid tile only has room for one line of text — the object's name, or its type when the
// name would overflow the fixed-size square.
const MAX_TILE_NAME_LENGTH = 18;

// An Instance is an Object (worldData/objects/items) owned by a character: the catalog data
// (name, rarity, type, tags) plus per-copy particulars (acquisition date, condition, owner).
// Rendered as a fixed-size grid tile — "Instance" stays a technical term, never shown to players.
// Hovering shows a tooltip (name + description); clicking hands the pair up to the parent, which
// opens the detail pop-up.
export default function InstanceTile({ instance, object, count = 1, onSelect }) {
  if (!object) return null;
  const typeLabel = OBJECT_TYPES.find((t) => t.value === object.type)?.label || object.type;
  const label = object.name.length > MAX_TILE_NAME_LENGTH ? typeLabel : object.name;
  const description = instance.description || object.description;

  return (
    <li>
      <button
        type="button"
        className={`instance-card inventory-tile rarity-${object.rarity}`}
        data-tooltip={description ? `${object.name} — ${description}` : object.name}
        onClick={() => onSelect({ instance, object })}
      >
        <span className="inventory-tile-label">{label}</span>
        {count > 1 && <span className="inventory-tile-count">{count}</span>}
      </button>
    </li>
  );
}
