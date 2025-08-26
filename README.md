# Orbit Cursor

> [!WARNING]
> In Development

# sqlx setup

```shell
cargo install sqlx-cli --no-default-features --features sqlite

# File paths
# MacOS - /Users/[username]/Library/Application Support/com.orbit-cursor/orbit-cursor.db
# Windows - C:\Users\[username]\AppData\Roaming\com.orbit-cursor\orbit-cursor.db

# Create the app folder, for relevant platform
mkdir -p "/Users/[username]/Library/Application Support/com.orbit-cursor"

# In `src-tauri`
sqlx database create --database-url "sqlite:[file path]"
sqlx migrate run --database-url "sqlite:[file path]"

```

To create the first migration run:

```shell
sqlx migrate add -r migration_name
```

This will ensure 2 migration files are created for any future migrate (`sqlx migrate add migration_name`), an up and a down.

These files are where you put your table creation/update SQL in.

Make sure to rename the prefix to the same version as in the migrations object in the next section (incremental numbers).

## Revert migrations

Use the following command (in `src-tauri`) to revert migrations, I got the url by printing the db setup path in code:

```shell
sqlx migrate revert --database-url="sqlite:[file path]"
```

## `.env`

Copy across the `.env.example` as `.env`, update the relevant path for your system.
