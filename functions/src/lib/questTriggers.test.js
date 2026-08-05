const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { questsWithTriggers, evaluateQuestTriggersForCharacter } = require("./questTriggers");

const CHARACTER = {
  reputation: 40,
  region: { id: "cote-des-brumes", name: "Côte des Brumes" },
  triggeredQuestIds: ["already-triggered"],
};

describe("questsWithTriggers", () => {
  test("keeps only quests with a non-empty trigger.conditions", () => {
    const quests = [
      { id: "no-trigger" },
      { id: "null-trigger", trigger: null },
      { id: "empty-conditions", trigger: { conditions: [] } },
      { id: "with-conditions", trigger: { conditions: [{ type: "minReputation", value: 10 }] } },
    ];
    assert.deepStrictEqual(
      questsWithTriggers(quests).map((q) => q.id),
      ["with-conditions"]
    );
  });
});

describe("evaluateQuestTriggersForCharacter", () => {
  test("grants a quest whose trigger conditions are met", () => {
    const triggerableQuests = [{ id: "reputation-quest", trigger: { conditions: [{ type: "minReputation", value: 10 }] } }];
    assert.deepStrictEqual(
      evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableQuests }),
      ["reputation-quest"]
    );
  });

  test("does not grant a quest whose trigger conditions are unmet", () => {
    const triggerableQuests = [{ id: "reputation-quest", trigger: { conditions: [{ type: "minReputation", value: 100 }] } }];
    assert.deepStrictEqual(evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableQuests }), []);
  });

  test("skips a quest already in character.triggeredQuestIds, even if its conditions still match", () => {
    const triggerableQuests = [{ id: "already-triggered", trigger: { conditions: [{ type: "minReputation", value: 10 }] } }];
    assert.deepStrictEqual(evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableQuests }), []);
  });

  test("ANDs multiple conditions, same as action availability", () => {
    const triggerableQuests = [
      {
        id: "combo-quest",
        trigger: {
          conditions: [
            { type: "minReputation", value: 10 },
            { type: "region", regionIds: ["autre-region"] },
          ],
        },
      },
    ];
    assert.deepStrictEqual(evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableQuests }), []);
  });

  test("evaluates hasInstanceTag against the supplied instanceTagIds set", () => {
    const triggerableQuests = [{ id: "instance-quest", trigger: { conditions: [{ type: "hasInstanceTag", tagId: "amulette" }] } }];
    assert.deepStrictEqual(
      evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableQuests, instanceTagIds: new Set(["amulette"]) }),
      ["instance-quest"]
    );
    assert.deepStrictEqual(evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableQuests }), []);
  });
});
