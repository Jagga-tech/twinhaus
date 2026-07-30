# Contributing to Twinhaus

Thanks for your interest! Twinhaus is early-stage, which means your contributions genuinely shape the project.

## Ways to contribute

- **Code**, grab an issue labeled `good first issue` or `help wanted`
- **3D device models**, low-poly `.glb` models of common smart devices (bulbs, sensors, locks)
- **Testing**, run it against your Home Assistant setup and report what breaks
- **Docs**, setup guides, especially for unusual HA configurations

## Development setup

1. Fork and clone the repo
2. `npm install`
3. `npm run dev`
4. You'll need a Home Assistant instance to test against, a [demo container](https://www.home-assistant.io/installation/) works fine

## Pull requests

- Branch from `main`, one feature per PR
- Keep PRs small and focused, easier to review, faster to merge
- Describe _what_ and _why_ in the PR body; screenshots/recordings for anything visual

## Checks

Before opening a PR, run the same checks CI runs:

```bash
npm run typecheck   # all workspaces
npm test            # vitest (agent loop, geometry, energy, IO, controls, …)
npm run build       # web production build
```

CI (`.github/workflows/ci.yml`) runs these on every pull request.

## Code style

- TypeScript everywhere
- Prettier defaults (run `npm run format` before committing)
- No inline comments unless the code genuinely can't speak for itself

## Questions?

Open a GitHub Discussion, no question is too basic.
