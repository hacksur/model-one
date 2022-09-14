import test from "ava";
import { Model } from '../lib'

test.beforeEach((t: any) => {
  const model = new Model({});
  Object.assign(t.context, { model });
});

test('returns itself', (t: any) => {
  t.true(t.context.model instanceof Model);
});