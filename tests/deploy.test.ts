import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareDeployment } from "../scripts/deploy-dokploy.ts";
const image = "ghcr.io/example/starter/docsgpt@sha256:" + "a".repeat(64);
test("legacy deployment requires the actual target CPU preflight before starting the API", () => {
  const doc = {
    services: {
      api: {
        image: "__DOCSGPT_IMAGE__",
        depends_on: {
          preflight: { condition: "service_completed_successfully" },
        },
      },
      preflight: {
        image: "__DOCSGPT_IMAGE__",
        network_mode: "none",
        command: ["python", "-m", "docsgpt.scripts.verify_offline"],
      },
    },
  };
  assert.doesNotThrow(() =>
    prepareDeployment(JSON.stringify(doc), image, image, true),
  );
  delete (doc.services.api as any).depends_on;
  assert.throws(() =>
    prepareDeployment(JSON.stringify(doc), image, image, true),
  );
});
test("release pins verified images while retaining private environment references and volumes", () => {
  const doc = prepareDeployment(
    JSON.stringify({
      services: {
        api: {
          image: "__DOCSGPT_IMAGE__",
          env_file: ".env",
          volumes: ["data:/app/data"],
        },
      },
    }),
    image,
    image,
  );
  assert.equal(doc.services.api.image, image);
  assert.equal(doc.services.api.env_file, ".env");
  assert.deepEqual(doc.services.api.volumes, ["data:/app/data"]);
  assert.equal(doc.services.api.pull_policy, "always");
});
test("release rejects tags and server-side builds before a deployment is requested", () => {
  assert.throws(() =>
    prepareDeployment(
      '{"services":{"api":{"image":"__DOCSGPT_IMAGE__"}}}',
      "ghcr.io/example/app:main",
      image,
    ),
  );
  assert.throws(() =>
    prepareDeployment(
      '{"services":{"api":{"image":"__DOCSGPT_IMAGE__","build":"."}}}',
      image,
      image,
    ),
  );
  assert.throws(() =>
    prepareDeployment(
      '{"services":{"api":{"image":"example:latest"}}}',
      image,
      image,
    ),
  );
});
