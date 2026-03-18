Indexing adds a separate data structure that helps find rows faster by a specific column.
Example with `user.email`:
```text
users
id | email              | password_hash
1  | a@example.com      | ...
2  | b@example.com      | ...
3  | c@example.com      | ...
```

Without an index, if we run
`SELECT * FROM users WHERE email = 'b@example.com'`
the database will perform a sequential search. In other words, it will read row by row and compare the email value.

But if we add an index, it creates a separate data structure roughly similar to a sorted directory:
```text
INDEX users_email_idx
a@example.com -> row 1
b@example.com -> row 2
c@example.com -> row 3
```

Now, for the same query, the database looks into the index, finds `b@example.com`, gets a reference to the row in the `users` table, and reads only that row.
This is a simplified explanation. In reality it works a bit differently, but the main principle is exactly this.

But an index is not free:
1. it takes disk space
2. it slows down `INSERT`, `UPDATE`, and `DELETE`, because the index must also be updated
3. if the index does not match real queries, it is just useless overhead
That is why you do not index everything, only what is actually used often in queries.

How to think about it correctly:
1. Look at real query patterns
2. If a column is often used in `WHERE`, it is a candidate for an index
3. If a column is unique (`email`, `jti`), an index is often needed and is usually created automatically through `UNIQUE`
4. If a column is often used to find related records (`user_id` in `refresh_tokens`), an index is almost always useful

At this point, I have three columns in the service that should have an index:
- `user.email`
- `refresh_tokens.jti`
- `refresh_tokens.user_id`

`user.email` and `refresh_tokens.jti` are `UNIQUE`, so the index is created automatically for them. `refresh_tokens.user_id` does not get an index automatically. It is a foreign key column that points to `users.id` in the `users` table. Since I have a route for deleting all of a user's `refresh_tokens`, `/auth/logout-all`, where the database needs to find all refresh tokens by user ID and delete them, the index will be useful. Right now I have not specified that `user_id` is a foreign key, so I will start with that.

In TypeORM migrations, this is usually done through `foreignKeys` in `new Table(...)` or through a separate `queryRunner.createForeignKey(...)` call.

ATTENTION! I am adding changes directly to the existing migration file that creates the `refresh_tokens` table. I can do this only because my database is still empty. The correct approach would be to add a new separate migration file where the changes are applied in a separate step. The general rule is: "If a migration has already been used, it must not be changed."

I will do it directly inside `new Table`. After `columns`, we specify `foreignKeys`, and after that `indices`. Shortened code from the service:
```TS
await queryRunner.createTable(
  new Table({
    name: 'refresh_tokens',
    columns: [
      {
        name: 'user_id',
        type: 'uuid',
        isNullable: false,
      },
    ],
    foreignKeys: [
      {
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE', // delete user -> delete all associated refresh tokens
      },
    ],
    indices: [
      {
        name: 'IDX_refresh_tokens_user_id',
        columnNames: ['user_id'],
      },
    ],
  }),
);
```
