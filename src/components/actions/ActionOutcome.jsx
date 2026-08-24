import { RARITIES } from "../creator/TalentsManager";
import { DIFFICULTIES } from "../../lib/difficulties";

const WOUND_LABELS = { light: "légère", severe: "grave", permanent: "permanente" };

function difficultyLabel(value) {
  return DIFFICULTIES.find((d) => d.value === value)?.label || value || "?";
}

// The recap of a resolved action: what happened, what it granted or cost. Shared between the
// completed-action dialog and the idle-state recap below the browser - previously duplicated in
// both places as quest-only markup (F4), written once here (docs/ISSUE-02-ACTION-FRAMEWORK.md
// §3.7). No prose line any more: the generated paragraph it used to open on went with the
// narrative generator (docs/TODO.md "Narration removal").
export default function ActionOutcome({ lastAction, showLoot, character }) {
  const sortedLoot = [...(lastAction.loot || [])].sort(
    (a, b) => RARITIES.findIndex((r) => r.value === b.rarity) - RARITIES.findIndex((r) => r.value === a.rarity)
  );
  const sortedTalentEvolutions = [...(lastAction.talentEvolutions || [])].sort(
    (a, b) => RARITIES.findIndex((r) => r.value === b.rarity) - RARITIES.findIndex((r) => r.value === a.rarity)
  );

  return (
    <>
      {lastAction.mission && (
        <p className="quest-info">
          Mission : {lastAction.mission.name}
          {lastAction.mission.locationName && ` — ${lastAction.mission.locationName}`}
        </p>
      )}

      {lastAction.location && <p className="quest-info">Exploration : {lastAction.location.name}</p>}

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

      {lastAction.rounds?.length > 0 && (
        <fieldset className="action-loot-box">
          <legend>Rencontres</legend>
          <ul className="instance-list">
            {lastAction.rounds.map((round, index) => (
              <li key={index} className={`difficulty-text-${round.difficulty}`}>
                {difficultyLabel(round.difficulty)} — {round.success ? "Succès" : "Échec"} (jet {round.score}/
                {round.threshold})
                {round.wound && ` — Blessure ${WOUND_LABELS[round.wound] || round.wound}`}
                {round.reputationGained > 0 && ` — +${round.reputationGained} réputation`}
              </li>
            ))}
          </ul>
          {lastAction.totalReputationGained > 0 && <p>Réputation totale gagnée : +{lastAction.totalReputationGained}</p>}
        </fieldset>
      )}

      {lastAction.missionsGenerated?.length > 0 && (
        <fieldset className="action-loot-box">
          <legend>Missions générées</legend>
          <ul className="instance-list">
            {lastAction.missionsGenerated.map((mission) => (
              <li key={mission.id} className={`difficulty-text-${mission.difficulty}`}>
                {mission.name} ({difficultyLabel(mission.difficulty)})
              </li>
            ))}
          </ul>
        </fieldset>
      )}

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
