import type { CanonicalItem } from '../types.ts'
import { item } from './_helper.ts'

const M = { department: 'food', category: 'meat_seafood', shopping_category: 'meat_seafood', storage_type: 'refrigerated' } as const
const LEAN = [{ attribute_id: 'ground_meat.lean' }] as const
const CHICKEN_CUT = [{ attribute_id: 'chicken.cut_bone' }, { attribute_id: 'chicken.skin' }] as const

export const MEAT_SEAFOOD: CanonicalItem[] = [
  /* --------------------------------- BEEF ---------------------------------- */
  item({ ...M, canonical_id: 'food.meat_seafood.beef.ground_beef', canonical_name: 'Ground Beef', default_display_name: 'Ground beef', subcategory: 'beef', default_unit: 'lb', allowed_units: ['lb', 'kg', 'g', 'package'], search_priority: 85, tags: ['protein', 'dinner'], aliases: [{ alias: 'hamburger', type: 'colloquial' }, { alias: 'hamburger meat', type: 'colloquial' }, { alias: 'minced beef', type: 'regional' }], attributes: [...LEAN] }),
  item({ ...M, canonical_id: 'food.meat_seafood.beef.steak', canonical_name: 'Steak', default_display_name: 'Steak', subcategory: 'beef', default_unit: 'lb', allowed_units: ['lb', 'kg', 'each', 'package'], search_priority: 72, tags: ['protein', 'dinner'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.beef.roast_beef_cut', canonical_name: 'Beef Roast', default_display_name: 'Beef roast', subcategory: 'beef', default_unit: 'each', allowed_units: ['each', 'lb', 'kg'], tags: ['protein', 'dinner'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.beef.stewing_beef', canonical_name: 'Stewing Beef', default_display_name: 'Stewing beef', subcategory: 'beef', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'], tags: ['protein', 'dinner'], aliases: [{ alias: 'stew meat', type: 'synonym' }] }),

  /* ------------------------------- POULTRY --------------------------------- */
  item({ ...M, canonical_id: 'food.meat_seafood.poultry.chicken', canonical_name: 'Chicken', default_display_name: 'Chicken', subcategory: 'poultry', concept_level: 'generic', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package', 'each'], search_priority: 74, tags: ['protein', 'dinner'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.poultry.chicken_breast', canonical_name: 'Chicken Breast', default_display_name: 'Chicken breasts', subcategory: 'poultry', parent_concept_id: 'food.meat_seafood.poultry.chicken', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'], search_priority: 84, tags: ['protein', 'dinner'], attributes: [...CHICKEN_CUT] }),
  item({ ...M, canonical_id: 'food.meat_seafood.poultry.chicken_thighs', canonical_name: 'Chicken Thighs', default_display_name: 'Chicken thighs', subcategory: 'poultry', parent_concept_id: 'food.meat_seafood.poultry.chicken', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'], search_priority: 72, tags: ['protein', 'dinner'], attributes: [...CHICKEN_CUT] }),
  item({ ...M, canonical_id: 'food.meat_seafood.poultry.chicken_wings', canonical_name: 'Chicken Wings', default_display_name: 'Chicken wings', subcategory: 'poultry', parent_concept_id: 'food.meat_seafood.poultry.chicken', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'], tags: ['protein', 'dinner', 'party'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.poultry.chicken_drumsticks', canonical_name: 'Chicken Drumsticks', default_display_name: 'Chicken drumsticks', subcategory: 'poultry', parent_concept_id: 'food.meat_seafood.poultry.chicken', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'], tags: ['protein', 'dinner'], aliases: [{ alias: 'drumsticks', type: 'colloquial' }] }),
  item({ ...M, canonical_id: 'food.meat_seafood.poultry.whole_chicken', canonical_name: 'Whole Chicken', default_display_name: 'Whole chicken', subcategory: 'poultry', parent_concept_id: 'food.meat_seafood.poultry.chicken', default_unit: 'each', allowed_units: ['each', 'lb', 'kg'], tags: ['protein', 'dinner'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.poultry.ground_chicken', canonical_name: 'Ground Chicken', default_display_name: 'Ground chicken', subcategory: 'poultry', parent_concept_id: 'food.meat_seafood.poultry.chicken', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'], tags: ['protein', 'dinner'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.poultry.ground_turkey', canonical_name: 'Ground Turkey', default_display_name: 'Ground turkey', subcategory: 'poultry', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'], tags: ['protein', 'dinner'], attributes: [...LEAN] }),
  item({ ...M, canonical_id: 'food.meat_seafood.poultry.turkey', canonical_name: 'Turkey', default_display_name: 'Turkey', subcategory: 'poultry', default_unit: 'each', allowed_units: ['each', 'lb', 'kg'], tags: ['protein', 'dinner', 'holiday'] }),

  /* ---------------------------------- PORK --------------------------------- */
  item({ ...M, canonical_id: 'food.meat_seafood.pork.bacon', canonical_name: 'Bacon', default_display_name: 'Bacon', subcategory: 'pork', default_unit: 'package', allowed_units: ['package', 'lb', 'g'], search_priority: 80, tags: ['protein', 'breakfast'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.pork.pork_chops', canonical_name: 'Pork Chops', default_display_name: 'Pork chops', subcategory: 'pork', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package', 'each'], tags: ['protein', 'dinner'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.pork.ground_pork', canonical_name: 'Ground Pork', default_display_name: 'Ground pork', subcategory: 'pork', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'], tags: ['protein', 'dinner'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.pork.pork_tenderloin', canonical_name: 'Pork Tenderloin', default_display_name: 'Pork tenderloin', subcategory: 'pork', default_unit: 'each', allowed_units: ['each', 'lb', 'package'], tags: ['protein', 'dinner'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.pork.ham', canonical_name: 'Ham', default_display_name: 'Ham', subcategory: 'pork', default_unit: 'each', allowed_units: ['each', 'lb', 'kg'], tags: ['protein', 'holiday'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.processed_meat.sausage', canonical_name: 'Sausage', default_display_name: 'Sausages', subcategory: 'processed_meat', default_unit: 'package', allowed_units: ['package', 'lb'], tags: ['protein', 'dinner', 'breakfast'], aliases: [{ alias: 'sausages', type: 'synonym' }] }),
  item({ ...M, canonical_id: 'food.meat_seafood.processed_meat.hot_dogs', canonical_name: 'Hot Dogs', default_display_name: 'Hot dogs', subcategory: 'processed_meat', default_unit: 'package', allowed_units: ['package'], tags: ['protein', 'dinner', 'summer'], aliases: [{ alias: 'wieners', type: 'regional' }, { alias: 'frankfurters', type: 'synonym' }] }),

  /* --------------------------------- LAMB ---------------------------------- */
  item({ ...M, canonical_id: 'food.meat_seafood.lamb.lamb_chops', canonical_name: 'Lamb Chops', default_display_name: 'Lamb chops', subcategory: 'lamb', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'], tags: ['protein', 'dinner'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.lamb.ground_lamb', canonical_name: 'Ground Lamb', default_display_name: 'Ground lamb', subcategory: 'lamb', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'], tags: ['protein', 'dinner'] }),

  /* -------------------------------- SEAFOOD -------------------------------- */
  item({ ...M, canonical_id: 'food.meat_seafood.seafood.salmon', canonical_name: 'Salmon', default_display_name: 'Salmon', subcategory: 'seafood', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package', 'each'], search_priority: 74, tags: ['protein', 'seafood', 'dinner'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.seafood.tilapia', canonical_name: 'Tilapia', default_display_name: 'Tilapia', subcategory: 'seafood', default_unit: 'lb', allowed_units: ['lb', 'package'], tags: ['protein', 'seafood'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.seafood.cod', canonical_name: 'Cod', default_display_name: 'Cod', subcategory: 'seafood', default_unit: 'lb', allowed_units: ['lb', 'package'], tags: ['protein', 'seafood'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.seafood.shrimp', canonical_name: 'Shrimp', default_display_name: 'Shrimp', subcategory: 'seafood', default_unit: 'lb', allowed_units: ['lb', 'kg', 'bag', 'package'], search_priority: 72, tags: ['protein', 'seafood', 'dinner'], aliases: [{ alias: 'prawns', type: 'regional' }] }),
  item({ ...M, canonical_id: 'food.meat_seafood.seafood.tuna_fresh', canonical_name: 'Tuna Steak', default_display_name: 'Tuna steak', subcategory: 'seafood', default_unit: 'lb', allowed_units: ['lb', 'package', 'each'], tags: ['protein', 'seafood'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.seafood.crab', canonical_name: 'Crab', default_display_name: 'Crab', subcategory: 'seafood', default_unit: 'lb', allowed_units: ['lb', 'package'], tags: ['protein', 'seafood'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.seafood.scallops', canonical_name: 'Scallops', default_display_name: 'Scallops', subcategory: 'seafood', default_unit: 'lb', allowed_units: ['lb', 'package'], tags: ['protein', 'seafood'] }),

  /* ----------------------------- PLANT PROTEIN ----------------------------- */
  item({ ...M, canonical_id: 'food.meat_seafood.plant_protein.tofu', canonical_name: 'Tofu', default_display_name: 'Tofu', subcategory: 'plant_protein', default_unit: 'package', allowed_units: ['package', 'each'], tags: ['protein', 'vegetarian'] }),
  item({ ...M, canonical_id: 'food.meat_seafood.plant_protein.plant_ground', canonical_name: 'Plant-Based Ground', default_display_name: 'Plant-based ground', subcategory: 'plant_protein', default_unit: 'package', allowed_units: ['package'], tags: ['protein', 'vegetarian'], aliases: [{ alias: 'meatless ground', type: 'synonym' }, { alias: 'veggie ground', type: 'colloquial' }] }),
  item({ ...M, canonical_id: 'food.meat_seafood.plant_protein.veggie_burgers', canonical_name: 'Veggie Burgers', default_display_name: 'Veggie burgers', subcategory: 'plant_protein', default_unit: 'box', allowed_units: ['box', 'package'], tags: ['protein', 'vegetarian'] }),
]
