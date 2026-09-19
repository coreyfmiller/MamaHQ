// MamaHQ Grocery — Tier-A canonical concepts.
//
// The catalog is split into per-category files under ./items/ for reviewability
// (Step 3B expansion). This module re-exports the deterministic aggregation so all
// existing importers (index.ts, validate.ts, scripts/seed-catalog.ts) keep working
// unchanged.
//
// Concepts are CONCEPTS ("what is this?"), never brands/SKUs, never combinatorial
// variants (variations are attributes). Ids are stable + hierarchical.

export { ITEMS } from './items/index.ts'
