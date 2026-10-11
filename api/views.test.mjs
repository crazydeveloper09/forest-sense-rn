import assert from "node:assert/strict";
import test from "node:test";
import { privacyContext, renderView } from "./views.mjs";

test("privacy view renders the policy and the RODO clause", async () => {
  const html = await renderView("privacy", privacyContext);

  assert.match(html, /Polityka prywatności/);
  assert.match(html, /Klauzula informacyjna RODO/);
  assert.match(html, /art\. 13/);
  assert.match(html, /forest\.sense@maciejsolutions\.pl/);
  assert.match(html, /Google Gemini/);
  assert.match(html, /Stripe/);
  assert.match(html, /AdMob/);
  assert.doesNotMatch(html, /\[e-mail\]/);
});

test("view data is escaped", async () => {
  const html = await renderView("privacy", {
    ...privacyContext,
    controllerName: "<script>alert(1)</script>",
  });

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("rejects a view name that leaves the views directory", () => {
  assert.throws(() => renderView("../http", {}), /Nieprawidłowa nazwa widoku/);
});
