# Orbit Cursor

> [!WARNING]
> In Development

# sqlx setup

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
sqlx migrate revert --database-url="sqlite:/Users/YOUR_USER/Library/Application Support/com.orbit-cursor/orbit-cursor.db"
```

## `.env`

Copy across the `.env.example` as `.env`, update the relevant path for your system.
