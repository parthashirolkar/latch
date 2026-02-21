fn main() {
    // Load .env file during build (including for tests)
    dotenvy::dotenv().ok();
    tauri_build::build()
}
