const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { subjectsWithTriggers, evaluateQuestTriggersForCharacter } = require("./questTriggers");

const CHARACTER = {
  reputation: 40,
  region: { id: "cote-des-brumes", name: "Côte des Brumes" },
  triggeredSubjectIds: ["already-triggered"],
};

describe("subjectsWithTriggers", () => {
  test("keeps only Subjects with a non-empty trigger.conditions", () => {
    const subjects = [
      { id: "no-trigger" },
      { id: "null-trigger", trigger: null },
      { id: "empty-conditions", trigger: { conditions: [] } },
      { id: "with-conditions", trigger: { conditions: [{ type: "minReputation", value: 10 }] } },
    ];
    assert.deepStrictEqual(
      subjectsWithTriggers(subjects).map((s) => s.id),
      ["with-conditions"]
    );
  });
});

describe("evaluateQuestTriggersForCharacter", () => {
  test("grants a Subject whose trigger conditions are met", () => {
    const triggerableSubjects = [{ id: "reputation-subject", trigger: { conditions: [{ type: "minReputation", value: 10 }] } }];
    assert.deepStrictEqual(
      evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableSubjects }),
      ["reputation-subject"]
    );
  });

  test("does not grant a Subject whose trigger conditions are unmet", () => {
    const triggerableSubjects = [{ id: "reputation-subject", trigger: { conditions: [{ type: "minReputation", value: 100 }] } }];
    assert.deepStrictEqual(evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableSubjects }), []);
  });

  test("skips a Subject already in character.triggeredSubjectIds, even if its conditions still match", () => {
    const triggerableSubjects = [{ id: "already-triggered", trigger: { conditions: [{ type: "minReputation", value: 10 }] } }];
    assert.deepStrictEqual(evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableSubjects }), []);
  });

  test("ANDs multiple conditions, same as action availability", () => {
    const triggerableSubjects = [
      {
        id: "combo-subject",
        trigger: {
          conditions: [
            { type: "minReputation", value: 10 },
            { type: "region", regionIds: ["autre-region"] },
          ],
        },
      },
    ];
    assert.deepStrictEqual(evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableSubjects }), []);
  });

  test("evaluates hasInstanceTag against the supplied instanceTagIds set", () => {
    const triggerableSubjects = [{ id: "instance-subject", trigger: { conditions: [{ type: "hasInstanceTag", tagId: "amulette" }] } }];
    assert.deepStrictEqual(
      evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableSubjects, instanceTagIds: new Set(["amulette"]) }),
      ["instance-subject"]
    );
    assert.deepStrictEqual(evaluateQuestTriggersForCharacter({ character: CHARACTER, triggerableSubjects }), []);
  });
});
