# Orbit Cursor

> [!WARNING]
> In Development

# sqlx setup

To automate creation of empty migration files install `sqlx-cli`:

```shell
cargo install sqlx-cli
```

For the first migration run:

```shell
sqlx migrate add -r migration_name
```

This will ensure 2 migration files are created for any future migrate (`sqlx migrate add migration_name`), an up and a down.

These files are where you put your table creation/update SQL in.

Make sure to rename the prefix to the same version as in the migrations object in the next section (incremental numbers).

## Revert migrations

Use the following command (in `src-tauri`) to revert migrations, I got the url by printing the db setup path in code:

```shell
sqlx migrate revert --database-url="/Users/YOUR_USER/Library/Application Support/com.your-bundle-name.app/your-db-name.db"
```
