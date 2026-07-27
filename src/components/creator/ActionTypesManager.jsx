import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

function emptyTier() {
  return {
    name: "",
    weight: 10,
    success: true,
    narrativeText: "",
    cible: "",
    goldGain: 0,
    itemGainName: "",
    itemGainQty: 1,
    talentGainId: "",
    talentGainQuality: 1,
    talentGainCircumstance: "",
    reputationGain: 0,
    legendary: false,
    consequenceType: "wound",
    consequenceName: "",
    consequenceDescription: "",
  };
}

function tierToForm(tier) {
  return {
    name: tier.name || "",
    weight: tier.weight ?? 10,
    success: tier.success !== false,
    narrativeText: tier.narrativeText || "",
    cible: tier.cible || "",
    goldGain: tier.goldGain || 0,
    itemGainName: tier.itemGain?.name || "",
    itemGainQty: tier.itemGain?.qty || 1,
    talentGainId: tier.talentGain?.talentId || "",
    talentGainQuality: tier.talentGain?.quality || 1,
    talentGainCircumstance: tier.talentGain?.circumstance || "",
    reputationGain: tier.reputationGain || 0,
    legendary: !!tier.legendary,
    consequenceType: tier.consequence?.type || "wound",
    consequenceName: tier.consequence?.name || "",
    consequenceDescription: tier.consequence?.description || "",
  };
}

function formToTier(form) {
  const tier = {
    name: form.name,
    weight: Number(form.weight),
    success: form.success,
    narrativeText: form.narrativeText,
  };

  if (form.cible) tier.cible = form.cible;

  if (form.success) {
    tier.goldGain = Number(form.goldGain) || 0;
    if (form.itemGainName) tier.itemGain = { name: form.itemGainName, qty: Number(form.itemGainQty) || 1 };
    if (form.talentGainId) {
      tier.talentGain = {
        talentId: form.talentGainId,
        quality: Number(form.talentGainQuality) || 1,
        circumstance: form.talentGainCircumstance,
      };
    }
    tier.reputationGain = Number(form.reputationGain) || 0;
    tier.legendary = !!form.legendary;
  } else {
    tier.consequence = {
      type: form.consequenceType,
      description: form.consequenceDescription,
      ...(form.consequenceType === "wound" ? { name: form.consequenceName } : {}),
    };
  }

  return tier;
}

function TierEditor({ tier, index, talents, onChange, onRemove }) {
  function set(field, value) {
    onChange(index, { ...tier, [field]: value });
  }

  return (
    <div className="tier-editor">
      <div className="tier-editor-row">
        <input placeholder="Nom du tier" value={tier.name} onChange={(e) => set("name", e.target.value)} required />
        <label>
          Poids
          <input type="number" value={tier.weight} onChange={(e) => set("weight", e.target.value)} required />
        </label>
        <label>
          <input type="checkbox" checked={tier.success} onChange={(e) => set("success", e.target.checked)} />
          Succès
        </label>
        <button type="button" onClick={() => onRemove(index)}>
          Supprimer ce tier
        </button>
      </div>

      <textarea
        placeholder="Texte narratif (utilisé tel quel si aucune cible n'est choisie ci-dessous, ou en repli si la génération procédurale ne trouve aucune combinaison)"
        value={tier.narrativeText}
        onChange={(e) => set("narrativeText", e.target.value)}
      />

      <label>
        Cible (génération procédurale du texte de résultat)
        <select value={tier.cible} onChange={(e) => set("cible", e.target.value)}>
          <option value="">Aucune (texte narratif fixe)</option>
          <option value="groupe">Groupe</option>
          <option value="individuel">Individuel</option>
        </select>
      </label>

      {tier.success ? (
        <fieldset>
          <legend>Gains (succès)</legend>
          <label>
            Or
            <input type="number" value={tier.goldGain} onChange={(e) => set("goldGain", e.target.value)} />
          </label>
          <label>
            Objet gagné
            <input placeholder="Nom de l'objet" value={tier.itemGainName} onChange={(e) => set("itemGainName", e.target.value)} />
          </label>
          <label>
            Quantité
            <input type="number" value={tier.itemGainQty} onChange={(e) => set("itemGainQty", e.target.value)} />
          </label>
          <label>
            Talent gagné
            <select value={tier.talentGainId} onChange={(e) => set("talentGainId", e.target.value)}>
              <option value="">(aucun)</option>
              {talents.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {tier.talentGainId && (
            <>
              <label>
                Qualité initiale
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={tier.talentGainQuality}
                  onChange={(e) => set("talentGainQuality", e.target.value)}
                />
              </label>
              <label>
                Circonstance de l'obtention
                <input
                  placeholder="ex : en bravant le souffle ardent du terrible Syrphax"
                  value={tier.talentGainCircumstance}
                  onChange={(e) => set("talentGainCircumstance", e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            Réputation gagnée
            <input type="number" value={tier.reputationGain} onChange={(e) => set("reputationGain", e.target.value)} />
          </label>
          <label>
            <input type="checkbox" checked={tier.legendary} onChange={(e) => set("legendary", e.target.checked)} />
            Exploit légendaire
          </label>
        </fieldset>
      ) : (
        <fieldset>
          <legend>Conséquence (échec)</legend>
          <label>
            <input
              type="radio"
              name={`consequence-${index}`}
              checked={tier.consequenceType === "wound"}
              onChange={() => set("consequenceType", "wound")}
            />
            Blessure
          </label>
          <label>
            <input
              type="radio"
              name={`consequence-${index}`}
              checked={tier.consequenceType === "death"}
              onChange={() => set("consequenceType", "death")}
            />
            Mort
          </label>
          {tier.consequenceType === "wound" && (
            <input
              placeholder="Nom de la blessure"
              value={tier.consequenceName}
              onChange={(e) => set("consequenceName", e.target.value)}
            />
          )}
          <textarea
            placeholder="Description de la conséquence"
            value={tier.consequenceDescription}
            onChange={(e) => set("consequenceDescription", e.target.value)}
          />
        </fieldset>
      )}
    </div>
  );
}

export default function ActionTypesManager() {
  const [actionTypes, setActionTypes] = useState([]);
  const [talents, setTalents] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [label, setLabel] = useState("");
  const [tiers, setTiers] = useState([emptyTier()]);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "actionTypes", "items"), (snap) => {
      setActionTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "talents", "items"), (snap) => {
      setTalents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredActionTypes = actionTypes.filter((actionType) => {
    const q = filterText.toLowerCase();
    return !q || (actionType.label || "").toLowerCase().includes(q);
  });

  function startEdit(actionType) {
    setEditingId(actionType.id);
    setLabel(actionType.label || "");
    setTiers((actionType.tiers || []).map(tierToForm));
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setLabel("");
    setTiers([emptyTier()]);
  }

  function updateTier(index, tier) {
    setTiers((prev) => prev.map((t, i) => (i === index ? tier : t)));
  }

  function removeTier(index) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "actionTypes", "items", editingId)
      : doc(collection(db, "worldData", "actionTypes", "items"));

    await setDoc(ref, { label, tiers: tiers.map(formToTier) });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Types d'action</h2>

      <fieldset>
        <legend>Filtres</legend>
        <input placeholder="Rechercher par libellé..." value={filterText} onChange={(e) => setFilterText(e.target.value)} />
        <button type="button" onClick={() => setFilterText("")}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filteredActionTypes.map((actionType) => (
          <li key={actionType.id}>
            <strong>{actionType.label}</strong> ({(actionType.tiers || []).length} tiers)
            <button type="button" onClick={() => startEdit(actionType)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "actionTypes", "items", actionType.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <details className="collapsible-group" open={panelOpen} onToggle={(e) => setPanelOpen(e.target.open)}>
        <summary>{editingId ? "Modifier le type d'action" : "Nouveau type d'action"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Libellé (ex: Partir en quête)" value={label} onChange={(e) => setLabel(e.target.value)} required />

          {tiers.map((tier, index) => (
            <TierEditor key={index} tier={tier} index={index} talents={talents} onChange={updateTier} onRemove={removeTier} />
          ))}

          <button type="button" onClick={() => setTiers([...tiers, emptyTier()])}>
            Ajouter un tier
          </button>

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer le type d'action"}</button>
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
