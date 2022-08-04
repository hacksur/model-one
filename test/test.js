const test = require('ava');
const { Model } = require('../lib');

test.beforeEach((t) => {
  const model = new Model({});
  Object.assign(t.context, { model });
});

test('returns itself', (t) => {
  t.true(t.context.model instanceof Model);
});