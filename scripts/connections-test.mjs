import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("async function loadFriendCandidates("), end = source.indexOf("function searchFriendsByGrade(", start);
function setup() {
  const requests = [], state = { user: { username: "alice" }, csrfToken: "session-a", friendSearch: "first" };
  const context = vm.createContext({ state, AbortController, renderFriends: () => {}, notify: () => assert.fail("Unexpected error notice"), api: (url, options) => new Promise((resolve) => requests.push({ url, options, resolve })) });
  vm.runInContext(source.slice(start, end), context);
  return { requests, state, load: context.loadFriendCandidates };
}
test("new friend queries are not dropped and older responses cannot replace newer results", async () => {
  const { requests, state, load } = setup();
  const first = load(); state.friendSearch = "@second"; const second = load();
  assert.equal(requests.length, 2); assert.equal(requests[0].options.signal.aborted, true);
  assert.match(requests[1].url, /q=second$/);
  requests[1].resolve({ people: [{ username: "second" }] }); await second;
  requests[0].resolve({ people: [{ username: "first" }] }); await first;
  assert.equal(state.friendCandidates[0].username, "second"); assert.equal(state.friendCandidatesLoading, false);
});
test("results from an earlier signed-in account are discarded", async () => {
  const { requests, state, load } = setup();
  const pending = load(); state.user = { username: "bob" }; state.csrfToken = "session-b";
  requests[0].resolve({ people: [{ username: "alice-private-result" }] }); await pending;
  assert.equal(state.friendCandidates, undefined);
});
