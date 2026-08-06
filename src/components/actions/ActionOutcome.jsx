import { RARITIES } from "../creator/TalentsManager";

const WOUND_LABELS = { light: "légère", severe: "grave", permanent: "permanente" };

// The narrative recap of a resolved action: what happened, what it granted or cost. Shared
// between the completed-action dialog and the idle-state recap below the browser - previously
// duplicated in both places as quest-only markup (F4), written once here
// (docs/ISSUE-02-ACTION-FRAMEWORK.md §3.7).
export default function ActionOutcome({ lastAction, showLoot, character }) {
  const sortedLoot = [...(lastAction.loot || [])].sort(
    (a, b) => RARITIES.findIndex((r) => r.value === b.rarity) - RARITIES.findIndex((r) => r.value === a.rarity)
  );
  const sortedTalentEvolutions = [...(lastAction.talentEvolutions || [])].sort(
    (a, b) => RARITIES.findIndex((r) => r.value === b.rarity) - RARITIES.findIndex((r) => r.value === a.rarity)
  );

  return (
    <>
      <p>{lastAction.narrativeText}</p>

      {lastAction.quest && (
        <p className="quest-info">
          Quête : {lastAction.quest.name}
          {lastAction.quest.locationName && ` — ${lastAction.quest.locationName}`}
        </p>
      )}

      {lastAction.mission && (
        <p className="quest-info">
          Mission : {lastAction.mission.name}
          {lastAction.mission.locationName && ` — ${lastAction.mission.locationName}`}
        </p>
      )}

      {lastAction.score != null && (
        <fieldset className="action-loot-box">
          <legend>Résolution</legend>
          <p>
            Jet : {lastAction.score} (seuil de réussite : {lastAction.threshold})
          </p>
          {lastAction.wound && (
            <p>
              Blessure infligée : {WOUND_LABELS[lastAction.wound] || lastAction.wound}
              {character &&
                ` — Blessures actuelles : ${character.woundsLight || 0} légère(s), ${character.woundsSevere || 0} grave(s), ${character.woundsPermanent || 0} permanente(s)`}
            </p>
          )}
          {lastAction.success && lastAction.reputationGained > 0 && <p>Réputation gagnée : +{lastAction.reputationGained}</p>}
        </fieldset>
      )}

      {lastAction.rumorsHarvested?.length > 0 && (
        <fieldset className="action-loot-box">
          <legend>Rumeurs collectées</legend>
          <ul className="instance-list">
            {lastAction.rumorsHarvested.map((rumor) => (
              <li key={rumor.id} className={`talent-card rarity-${rumor.rarity}`}>
                {rumor.text}
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      {lastAction.missionsGeneratedCount > 0 && <p>Missions générées : {lastAction.missionsGeneratedCount}</p>}

      {lastAction.success && (
        <ul>
          {(lastAction.goldGain > 0 || lastAction.itemGain) && (
            <li>
              Gain : {lastAction.goldGain > 0 && `${lastAction.goldGain} or`}
              {lastAction.itemGain && ` ${lastAction.itemGain.name}`}
            </li>
          )}
          {lastAction.talentGain && (
            <li>
              Nouveau talent : {lastAction.talentGain.name} {lastAction.talentGain.quality}
            </li>
          )}
          {lastAction.reputationGain > 0 && <li>Réputation : +{lastAction.reputationGain}</li>}
          {lastAction.goldSpent > 0 && <li>Or dépensé : {lastAction.goldSpent}</li>}
          {lastAction.legendary && <li className="legendary">Exploit légendaire !</li>}
        </ul>
      )}

      {showLoot && sortedLoot.length > 0 && (
        <fieldset className="action-loot-box">
          <legend>Butin obtenu</legend>
          <ul className="instance-list">
            {sortedLoot.map((item, index) => (
              <li key={index} className={`instance-card rarity-${item.rarity}`}>
                {item.name}
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {sortedTalentEvolutions.length > 0 && (
        <fieldset className="action-loot-box">
          <legend>Amélioration de talent</legend>
          <ul className="instance-list">
            {sortedTalentEvolutions.map((t, index) => (
              <li key={index} className={`talent-card rarity-${t.rarity}`}>
                {t.kind === "unlock" ? "Nouveau : " : ""}
                {t.name} {t.quality}
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </>
  );
}
