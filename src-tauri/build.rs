fn main() {
  let database_path = dotenvy_macro::dotenv!("DATABASE_PATH");
  println!("cargo:rustc-env=DATABASE_URL=sqlite://{database_path}"); // For sqlx query! macros

  tauri_build::build()
}
