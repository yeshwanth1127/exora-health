import assert from "node:assert/strict";
import { test } from "node:test";
import { toCsv } from "../src/lib/csv.ts";

test("csv quotes every cell and defuses spreadsheet formulas", () => {
  assert.equal(
    toCsv([["name", "note"], ['=HYPERLINK("x")', 'say "hi"'], ["-2+3", null], ["@cmd", { a: 1 }]]),
    '"name","note"\r\n"\'=HYPERLINK(""x"")","say ""hi"""\r\n"\'-2+3",""\r\n"\'@cmd","{""a"":1}"\r\n',
  );
});
