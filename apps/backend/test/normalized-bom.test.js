const { test } = require("node:test");
const assert = require("node:assert/strict");

const { parseOrderQuantity } = require("../src/services/normalized-bom");

test("Production Order quantity must be a positive whole number", () => {
  assert.strictEqual(parseOrderQuantity("1000"), 1000);
  for (const value of [undefined, null, 0, -1, 1.5, "many"]) {
    assert.throws(
      () => parseOrderQuantity(value),
      (error) => error.code === "VALIDATION",
    );
  }
});
