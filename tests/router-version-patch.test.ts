import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { patchBundle } from "../ops/omniroute-client-version/patch.js";

test("router compatibility patch changes only the verified client-version floors", () => {
  const fixture =
    '/* OmniRoute-AntigravityVersion/1.0 */ let d="2.1.1",e="1.1.5",f={cache:null,inFlight:null}; result=[d,e]; const unrelated="2.1.1";';
  const result = patchBundle(fixture, "2.7.0", "1.5.10");
  const context = { result: [] };
  runInNewContext(result, context);
  assert.equal(JSON.stringify(context.result), '["2.7.0","1.5.10"]');
  assert.ok(result.includes('const unrelated="2.1.1"'));
  assert.throws(() => patchBundle(result, "2.7.0", "1.5.10"), /Unexpected/);
  assert.throws(
    () => patchBundle(fixture + fixture, "2.7.0", "1.5.10"),
    /Unexpected/,
  );
  assert.throws(() => patchBundle(fixture, "latest", "1.5.10"), /numeric/);
});
