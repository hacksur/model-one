export const schema = [
  `
  CREATE TABLE users (
    id text PRIMARY KEY,
    name text,
    languages text,
    deleted_at datetime,
    created_at datetime,
    updated_at datetime2
  );`
]