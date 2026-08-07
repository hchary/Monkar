// The 6-tier mission/quest difficulty scale (docs/TODO.md "Quest difficulty") - own enum, not the
// 8-tier rarity enum shared by talents/objects/loot tables, since only some tiers carry over
// semantically to "how hard is this". Originally lived in src/components/creator/QuestsManager.jsx;
// relocated here once that manager was retired (docs/TODO.md "Retiring quests and quest objectives
// for the subject-action system") so its remaining consumers - none of them quest-specific - don't
// depend on a deleted file.
export const DIFFICULTIES = [
  { value: "facile", label: "Facile" },
  { value: "moyen", label: "Moyen" },
  { value: "difficile", label: "Difficile" },
  { value: "tres_difficile", label: "Très difficile" },
  { value: "epique", label: "Épique" },
  { value: "mythique", label: "Mythique" },
];
