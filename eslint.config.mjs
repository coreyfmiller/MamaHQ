// MamaHQ — ESLint flat config (Step 5C).
//
// Pragmatic, correctness-focused lint for Next.js 16 / React 19 / TypeScript.
// Goal (per Step 5C §27/§49): catch meaningful defects, NOT enforce a stylistic
// rewrite. We compose Next's shipped FLAT configs (core-web-vitals + TypeScript,
// which bundle @next/eslint-plugin-next, eslint-plugin-react,
// eslint-plugin-react-hooks, and typescript-eslint) and then relax the handful of
// rules that would otherwise produce high-volume, low-value noise on the existing
// codebase.
//
// Next 16 removed the `next lint` command, so linting runs via the ESLint CLI
// (`eslint .`) wired to `npm run lint`. eslint-config-next@16 exports flat configs
// directly, so no FlatCompat / .eslintrc shim is required.

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  // Never lint generated, vendored, or build output — avoids meaningless churn.
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '_ui_prototype/**',
      'next-env.d.ts',
      'public/**',
      '**/*.log',
      'supabase/**',
    ],
  },

  // Existing files carry defensive `eslint-disable jsx-a11y/no-autofocus`
  // directives. Next's current flat config doesn't surface that rule as an error,
  // so those directives report as "unused". They are harmless and intentional
  // (they document why autoFocus is acceptable there); do NOT churn 9 files to
  // strip them. Simply don't report unused directives as problems.
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },

  // Next.js recommended (core-web-vitals) + TypeScript flat rule-sets.
  ...nextCoreWebVitals,
  ...nextTypeScript,

  // Project-wide rule tuning: keep correctness signal, drop stylistic noise.
  {
    rules: {
      // react-hooks 7 (React Compiler) introduces `set-state-in-effect`, which
      // flags the existing store hydration pattern (`setHydrated(false)` before an
      // async fetch) across ~8 stores. That pattern is intentional, working, and
      // build-verified; rewriting every store's effect/hydration logic would be the
      // exact "state-management rewrite" Step 5C forbids (§47). Keep the advisory
      // VISIBLE as a warning instead of churning working code. Revisit deliberately
      // if/when the stores are refactored (tracked in docs/TECHNICAL_DEBT.md).
      'react-hooks/set-state-in-effect': 'warn',
      // Deterministic domain code + tests use `any` sparingly and pragmatically;
      // warn (visible) rather than error (blocking) so the gate never fails on
      // pre-existing pragmatic usage.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused vars are a real defect signal, but allow the conventional
      // underscore-prefix escape hatch for intentional throwaways.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // Node-run scripts (catalog seed, tests, benches) are not browser code.
  {
    files: ['scripts/**/*.ts', 'lib/grocery/catalog/validate.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]

export default config
