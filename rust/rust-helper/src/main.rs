fn main() {
    if let Err(error) = rust_helper::run_cli() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
