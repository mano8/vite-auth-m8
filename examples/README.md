# vite-auth-m8 examples

These examples replace the old `fa-auth-m8/examples/addon` template with
package-based Chrome MV3 extension projects.

## Examples

| Directory | UI stack | Purpose |
| --- | --- | --- |
| `vanilla-extension` | DOM helpers | Minimal extension without a framework runtime |
| `preact-extension` | Preact | Preact provider, hooks, and default views |
| `react-extension` | React | React provider, hooks, and default views |

Each example uses the same Vite plugin configuration as the source of truth for
the generated manifest, CSP, host permissions, Rollup inputs, and runtime API
base.

## Build

From the package root:

```bash
npm run build
npm run build:examples
```

Outputs are written to each example's `dist/` directory.

## Backend settings

The backend must allow Chrome extension origins and redirect targets:

```env
CORS_ALLOWED_ORIGIN_SCHEMES=chrome-extension://
OAUTH_ALLOWED_REDIRECT_SCHEMES=chrome-extension://
```

Google OAuth still redirects to the backend callback. Configure the Google
Console redirect URI to match the backend callback exactly, for example:

```text
https://localhost:4430/user/google-auth/oauth-callback/
```

Recommended backend posture for extension deployments:

```env
TOKEN_MODE=stateful
ACCESS_TOKEN_ALGORITHM=RS256
```

Use asymmetric signing where available. Avoid stateless-only extension
deployments for apps that need fast logout, revocation, or session invalidation.

## Migration from `fa-auth-m8/examples/addon`

The old addon copied auth logic into an example app. These examples import the
runtime, plugin, and UI adapters from `@fa-m8/vite-auth-m8` instead:

- generated `manifest.json`, CSP, host permissions, and Vite inputs come from
  `faAuthM8Extension()`
- backend responses are validated by the package Zod schemas
- PKCE verifiers are stored in `chrome.storage.session`
- auth state is stored in `chrome.storage.local`
- JWT parsing remains display-only
- `authFetch()` attaches bearer or API key headers and clears auth on `401`

After consumers move to these examples, the old addon directory can be removed
from `fa-auth-m8`.
