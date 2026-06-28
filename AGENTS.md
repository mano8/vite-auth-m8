# vite-auth-m8

## Layer
Client (Vite Chrome MV3 extension plugin)

---

## Purpose
Reusable Vite plugin and runtime helpers for building `fa-auth-m8` powered
Chrome extensions.

---

## Responsibilities
- generate extension build configuration from one plugin config
- provide framework-neutral auth runtime helpers
- provide vanilla, Preact, and React extension UI adapters

---

## Rules
- Talk to `fa-auth-m8` over public HTTP endpoints only.
- Do not import service-layer Python code.
- Do not store Google client secrets or backend secrets.
- Keep privileged extension logic in background workers or extension pages.
- Keep content scripts UI-only.
- Validate backend responses with Zod before use.

---

## Authority
All rules come from `/.Codex/policy.index.json` (type: typescript).
