/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production builds must fail on TypeScript errors. `tsc --noEmit` is currently clean, so the
  // previous `typescript.ignoreBuildErrors: true` was masking nothing and has been removed.
  // If a future change reintroduces type errors, the build SHOULD fail — fix the types, don't
  // re-add the flag (see ROADMAP.md / SAFETY.md: the DB is a system of record).
  images: {
    // Revisit at deploy (ROADMAP Step 16): Next image optimization vs. our actual image usage.
    // Kept unoptimized for now to match the v0 export baseline; not a permanent decision.
    unoptimized: true,
  },
}

export default nextConfig
