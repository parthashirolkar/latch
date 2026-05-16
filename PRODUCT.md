# Product

## Register

product

## Users

Privacy-conscious individuals who need secure, local password management. They use a desktop command-palette interface for quick access. Context: unlocking the app to copy a password, add a new credential, or check vault health. Often in focused, time-sensitive moments.

## Product Purpose

A desktop password manager with a Raycast-style command palette UI. Credentials are stored in an encrypted Vault on disk, decrypted into an in-memory Workspace during an active Session. The design must communicate security, trustworthiness, and speed.

## Brand Personality

Secure. Focused. Uncompromising. No playful gimmicks — the tool handles sensitive data and should look the part. Personality lives in the Win98 theme as an optional nostalgic nod, but the core experience is professional and calm.

## Anti-references

- Whimsical, cartoonish, or playful themes (the current Brutalist/Terminal/Editorial themes)
- SaaS-dashboard clichés (navy + gold, gradient heroes, big metric cards)
- Cyberpunk neon aesthetics for a security tool
- Low-contrast "designery" text that sacrifices legibility

## Design Principles

1. **Security is serious** — The UI should feel like a professional tool, not a toy. Themes should earn their place.
2. **Speed of access** — Users open this to get a password quickly. Every visual decision should reduce friction, not add it.
3. **Clarity in all modes** — Whether dark, light, retro, or high-contrast, information hierarchy must be instant and unambiguous.
4. **Theme as utility, not decoration** — Each theme serves a real use case (night use, day use, accessibility, nostalgia).
5. **Maintainable theming** — Adding a new theme should be possible by editing CSS variables and a single config file, not refactoring components.

## Accessibility & Inclusion

- WCAG AA minimum, with an AAA high-contrast theme available
- Support for reduced motion
- Color-blind safe indicators (icons + color, never color alone)
- Keyboard-navigable command palette interface
