# vite-auth-m8

Vite plugin and runtime package for building Chrome MV3 extensions that
authenticate through `fa-auth-m8`.

Package name: `@fa-m8/vite-auth-m8`.

This repository owns the new extension plugin work. The old
`fa-auth-m8/examples/addon` project is migration input only.

## Tailwind and shadcn

Patch Tailwind content paths for generated extension UI:

```bash
npx vite-auth-m8 init --framework react --tailwind
npx vite-auth-m8 init --framework preact --tailwind --shadcn
```

The package also exports React and Preact-compatible shadcn-style registry
blocks from `@fa-m8/vite-auth-m8/shadcn`. The blocks import the package auth UI
adapters, so generated components do not copy authentication logic.
