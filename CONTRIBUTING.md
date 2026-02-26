# Contributing to Latch

First off, thank you for considering contributing to Latch! It's people like you that make Latch such a great tool.

## Development Setup

1. Make sure you have Node.js, bun, and Rust installed.
2. Clone the repository.
3. Install frontend dependencies:
   ```bash
   cd frontend
   bun install
   ```
4. Start the development server:
   ```bash
   bun dev
   ```

## Code Style

- Frontend: We use ESLint and Prettier. Run `bun run lint` before committing.
- Backend (Rust): We use standard Rust formatting. Run `cargo fmt` and `cargo clippy`.

## Pull Request Process

1. Ensure any changes are documented in `CHANGELOG.md`.
2. Update the README.md with details of changes if applicable.
3. The PR will be merged once you have the sign-off of at least one maintainer.

## Commit Messages

Please provide clear, concise commit messages that describe what the change does.
