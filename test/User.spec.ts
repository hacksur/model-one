import test from "ava";
import Joi from 'joi'
import { createSQLiteDB } from '@miniflare/shared';
import { D1Database, D1DatabaseAPI } from '@miniflare/d1';
import { Model, Schema, type SchemaConfigI, Form } from '../lib'
import { schema } from './_database';

const joiSchema = Joi.object({
  id: Joi.string(),
  name: Joi.string(),
  languages: Joi.array(),
})

export class UserForm extends Form {
  constructor(data: UserI) {
    super(joiSchema, data)
  }
}

const userSchema: SchemaConfigI = new Schema({
  table_name: 'users',
  columns: [
    { name: 'id', type: 'string'},
    { name: 'name', type: 'string'},
    { name: 'languages', type: 'jsonb'},
  ]
})

interface UserDataI {
  id?: string
  name?: string
  languages?: string[]
}

interface UserI extends Model {
  data: UserDataI
}

class User extends Model implements UserI {
  data: UserDataI

  constructor(props: UserDataI) {
    super(userSchema, props)
    this.data = props
  }
}


test.beforeEach(async (t) => {
  const sqliteDb = await createSQLiteDB(':memory:');
  const db = new D1Database(new D1DatabaseAPI(sqliteDb));
  await db.batch(schema.map((item: string) => db.prepare(item)));
  t.context = { db };
});

test('Create an user', async (t) => {
  const { db: binding }: any = t.context;
  const userForm = new UserForm(new User({ name: 'John' }))

  const user = await User.create(userForm, binding)

  t.deepEqual(user.name, 'John')
});

test('Create an user with jsonb', async (t) => {
  const { db: binding }: any = t.context;
  const userForm = new UserForm(new User({ name: 'John', languages: ['es', 'en'] }))

  const user = await User.create(userForm, binding)
  t.deepEqual(user.name, 'John')
});

test('Create and update user with jsonb', async (t) => {
  const { db: binding }: any = t.context;
  const userForm = new UserForm(new User({ name: 'John', languages: ['es', 'en'] }))

  const user = await User.create(userForm, binding)

  const updatedUser = await User.update({ id: user.id, name: 'Caro', languages: [ 'es', 'en', 'fr' ]}, binding)
  t.deepEqual(typeof updatedUser.languages, 'object')
});
