const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  MISSIONS_REQUIRED_BASE,
  MISSIONS_REQUIRED_MIN,
  missionsRequiredForRenseignement,
} = require("./missionsRequiredForRenseignement");

describe("missionsRequiredForRenseignement", () => {
  test("requires the base count at 0 reputation", () => {
    assert.equal(missionsRequiredForRenseignement(0), MISSIONS_REQUIRED_BASE);
    assert.equal(missionsRequiredForRenseignement(null), MISSIONS_REQUIRED_BASE);
    assert.equal(missionsRequiredForRenseignement(undefined), MISSIONS_REQUIRED_BASE);
  });

  test("drops by one every 20 reputation", () => {
    assert.equal(missionsRequiredForRenseignement(20), MISSIONS_REQUIRED_BASE - 1);
    assert.equal(missionsRequiredForRenseignement(39), MISSIONS_REQUIRED_BASE - 1);
    assert.equal(missionsRequiredForRenseignement(40), MISSIONS_REQUIRED_BASE - 2);
  });

  test("floors at 1, never fully free", () => {
    assert.equal(missionsRequiredForRenseignement(1000), MISSIONS_REQUIRED_MIN);
  });

  test("negative reputation never exceeds the base requirement", () => {
    assert.equal(missionsRequiredForRenseignement(-50), MISSIONS_REQUIRED_BASE);
  });
});
