import { RARITIES } from "../creator/TalentsManager";

// The narrative recap of a resolved action: what happened, what it granted or cost. Shared
// between the completed-action dialog and the idle-state recap below the browser - previously
// duplicated in both places as quest-only markup (F4), written once here
// (docs/ISSUE-02-ACTION-FRAMEWORK.md §3.7).
export default function ActionOutcome({ lastAction, showLoot }) {
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

      {!lastAction.success && lastAction.consequence && (
        <ul>
          <li>Cause : {lastAction.consequence.description}</li>
          {lastAction.consequence.type === "wound" && <li>Blessure : {lastAction.consequence.name}</li>}
          {(lastAction.consequence.type === "death" || lastAction.consequence.fatal) && (
            <li className="fatal">Ton personnage est mort.</li>
          )}
        </ul>
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
