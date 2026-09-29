import assert from "node:assert/strict";
import test from "node:test";
import { THREAD_MESSAGE_LIMIT, threadIsFull } from "../src/domain/thread.ts";

test("un fil accepte des messages jusqu’à la limite, puis demande un nouveau fil", () => {
  assert.equal(THREAD_MESSAGE_LIMIT, 40);
  assert.equal(threadIsFull(0), false);
  assert.equal(threadIsFull(THREAD_MESSAGE_LIMIT - 1), false);
  assert.equal(threadIsFull(THREAD_MESSAGE_LIMIT), true);
  assert.equal(threadIsFull(THREAD_MESSAGE_LIMIT + 5), true);
});
