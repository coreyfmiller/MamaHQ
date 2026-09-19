import type { CanonicalItem } from '../types.ts'
import { item } from './_helper.ts'

const P = { department: 'food', category: 'pantry', shopping_category: 'pantry', storage_type: 'ambient' } as const

export const PANTRY: CanonicalItem[] = [
  /* ---------------------------------- PASTA -------------------------------- */
  item({ ...P, canonical_id: 'food.pantry.pasta.pasta', canonical_name: 'Pasta', default_display_name: 'Pasta', subcategory: 'pasta', concept_level: 'generic', default_unit: 'box', allowed_units: ['box', 'bag', 'g'], search_priority: 82, tags: ['dinner', 'staple'], aliases: [{ alias: 'noodles', type: 'colloquial' }], attributes: [{ attribute_id: 'pasta.shape' }] }),
  item({ ...P, canonical_id: 'food.pantry.pasta.spaghetti', canonical_name: 'Spaghetti', default_display_name: 'Spaghetti', subcategory: 'pasta', parent_concept_id: 'food.pantry.pasta.pasta', default_unit: 'box', allowed_units: ['box', 'bag'], search_priority: 76, tags: ['dinner', 'staple'] }),
  item({ ...P, canonical_id: 'food.pantry.pasta.macaroni', canonical_name: 'Macaroni', default_display_name: 'Macaroni', subcategory: 'pasta', parent_concept_id: 'food.pantry.pasta.pasta', default_unit: 'box', allowed_units: ['box', 'bag'], tags: ['dinner'] }),
  item({ ...P, canonical_id: 'food.pantry.pasta.penne', canonical_name: 'Penne', default_display_name: 'Penne', subcategory: 'pasta', parent_concept_id: 'food.pantry.pasta.pasta', default_unit: 'box', allowed_units: ['box', 'bag'], tags: ['dinner'] }),
  item({ ...P, canonical_id: 'food.pantry.pasta.lasagna_noodles', canonical_name: 'Lasagna Noodles', default_display_name: 'Lasagna noodles', subcategory: 'pasta', parent_concept_id: 'food.pantry.pasta.pasta', default_unit: 'box', allowed_units: ['box'], tags: ['dinner'] }),
  item({ ...P, canonical_id: 'food.pantry.pasta.egg_noodles', canonical_name: 'Egg Noodles', default_display_name: 'Egg noodles', subcategory: 'pasta', parent_concept_id: 'food.pantry.pasta.pasta', default_unit: 'bag', allowed_units: ['bag', 'box'], tags: ['dinner'] }),

  /* ------------------------------ RICE & GRAINS ---------------------------- */
  item({ ...P, canonical_id: 'food.pantry.rice_grains.rice', canonical_name: 'Rice', default_display_name: 'Rice', subcategory: 'rice_grains', concept_level: 'generic', default_unit: 'bag', allowed_units: ['bag', 'kg', 'lb', 'box'], search_priority: 82, tags: ['dinner', 'staple'], attributes: [{ attribute_id: 'rice.type' }] }),
  item({ ...P, canonical_id: 'food.pantry.rice_grains.white_rice', canonical_name: 'White Rice', default_display_name: 'White rice', subcategory: 'rice_grains', parent_concept_id: 'food.pantry.rice_grains.rice', default_unit: 'bag', allowed_units: ['bag', 'kg'], tags: ['dinner', 'staple'], attributes: [{ attribute_id: 'rice.type' }] }),
  item({ ...P, canonical_id: 'food.pantry.rice_grains.brown_rice', canonical_name: 'Brown Rice', default_display_name: 'Brown rice', subcategory: 'rice_grains', parent_concept_id: 'food.pantry.rice_grains.rice', default_unit: 'bag', allowed_units: ['bag', 'kg'], tags: ['dinner'], attributes: [{ attribute_id: 'rice.type' }] }),
  item({ ...P, canonical_id: 'food.pantry.rice_grains.quinoa', canonical_name: 'Quinoa', default_display_name: 'Quinoa', subcategory: 'rice_grains', default_unit: 'bag', allowed_units: ['bag', 'box'], tags: ['dinner', 'grain'] }),
  item({ ...P, canonical_id: 'food.pantry.rice_grains.couscous', canonical_name: 'Couscous', default_display_name: 'Couscous', subcategory: 'rice_grains', default_unit: 'box', allowed_units: ['box', 'bag'], tags: ['dinner', 'grain'] }),

  /* --------------------------------- CANNED -------------------------------- */
  item({ ...P, canonical_id: 'food.pantry.canned.canned_tomatoes', canonical_name: 'Canned Tomatoes', default_display_name: 'Canned tomatoes', subcategory: 'canned', default_unit: 'can', allowed_units: ['can'], search_priority: 74, tags: ['pantry', 'cooking'], aliases: [{ alias: 'diced tomatoes', type: 'colloquial' }] }),
  item({ ...P, canonical_id: 'food.pantry.canned.tomato_paste', canonical_name: 'Tomato Paste', default_display_name: 'Tomato paste', subcategory: 'canned', default_unit: 'can', allowed_units: ['can'], tags: ['pantry', 'cooking'] }),
  item({ ...P, canonical_id: 'food.pantry.canned.canned_tuna', canonical_name: 'Canned Tuna', default_display_name: 'Canned tuna', subcategory: 'canned', default_unit: 'can', allowed_units: ['can'], search_priority: 74, tags: ['pantry', 'protein', 'lunch'], aliases: [{ alias: 'tuna', type: 'colloquial' }, { alias: 'tinned tuna', type: 'regional' }] }),
  item({ ...P, canonical_id: 'food.pantry.canned.canned_salmon', canonical_name: 'Canned Salmon', default_display_name: 'Canned salmon', subcategory: 'canned', default_unit: 'can', allowed_units: ['can'], tags: ['pantry', 'protein'] }),
  item({ ...P, canonical_id: 'food.pantry.canned.canned_corn', canonical_name: 'Canned Corn', default_display_name: 'Canned corn', subcategory: 'canned', default_unit: 'can', allowed_units: ['can'], tags: ['pantry', 'vegetable'] }),
  item({ ...P, canonical_id: 'food.pantry.canned.canned_peas', canonical_name: 'Canned Peas', default_display_name: 'Canned peas', subcategory: 'canned', default_unit: 'can', allowed_units: ['can'], tags: ['pantry', 'vegetable'] }),
  item({ ...P, canonical_id: 'food.pantry.canned.canned_mushrooms', canonical_name: 'Canned Mushrooms', default_display_name: 'Canned mushrooms', subcategory: 'canned', default_unit: 'can', allowed_units: ['can'], tags: ['pantry', 'cooking'] }),

  /* --------------------------------- LEGUMES ------------------------------- */
  item({ ...P, canonical_id: 'food.pantry.legumes.chickpeas', canonical_name: 'Chickpeas', default_display_name: 'Chickpeas', subcategory: 'legumes', default_unit: 'can', allowed_units: ['can', 'bag'], search_priority: 70, tags: ['protein', 'pantry'], aliases: [{ alias: 'garbanzo beans', type: 'synonym' }, { alias: 'garbanzos', type: 'synonym' }] }),
  item({ ...P, canonical_id: 'food.pantry.legumes.black_beans', canonical_name: 'Black Beans', default_display_name: 'Black beans', subcategory: 'legumes', default_unit: 'can', allowed_units: ['can', 'bag'], tags: ['protein', 'pantry'] }),
  item({ ...P, canonical_id: 'food.pantry.legumes.kidney_beans', canonical_name: 'Kidney Beans', default_display_name: 'Kidney beans', subcategory: 'legumes', default_unit: 'can', allowed_units: ['can', 'bag'], tags: ['protein', 'pantry'] }),
  item({ ...P, canonical_id: 'food.pantry.legumes.baked_beans', canonical_name: 'Baked Beans', default_display_name: 'Baked beans', subcategory: 'legumes', default_unit: 'can', allowed_units: ['can'], tags: ['pantry'] }),
  item({ ...P, canonical_id: 'food.pantry.legumes.lentils', canonical_name: 'Lentils', default_display_name: 'Lentils', subcategory: 'legumes', default_unit: 'bag', allowed_units: ['bag', 'can'], tags: ['protein', 'pantry'] }),
  item({ ...P, canonical_id: 'food.pantry.legumes.refried_beans', canonical_name: 'Refried Beans', default_display_name: 'Refried beans', subcategory: 'legumes', default_unit: 'can', allowed_units: ['can'], tags: ['pantry', 'mexican'] }),

  /* ---------------------------------- SOUP --------------------------------- */
  item({ ...P, canonical_id: 'food.pantry.soup.canned_soup', canonical_name: 'Canned Soup', default_display_name: 'Canned soup', subcategory: 'soup', default_unit: 'can', allowed_units: ['can'], search_priority: 72, tags: ['pantry', 'lunch'], aliases: [{ alias: 'soup', type: 'colloquial' }, { alias: 'tomato soup', type: 'colloquial' }, { alias: 'chicken noodle soup', type: 'colloquial' }] }),
  item({ ...P, canonical_id: 'food.pantry.broth_stock.chicken_broth', canonical_name: 'Chicken Broth', default_display_name: 'Chicken broth', subcategory: 'broth_stock', default_unit: 'carton', allowed_units: ['carton', 'can', 'box'], search_priority: 70, tags: ['pantry', 'cooking'], aliases: [{ alias: 'chicken stock', type: 'synonym' }] }),
  item({ ...P, canonical_id: 'food.pantry.broth_stock.beef_broth', canonical_name: 'Beef Broth', default_display_name: 'Beef broth', subcategory: 'broth_stock', default_unit: 'carton', allowed_units: ['carton', 'can'], tags: ['pantry', 'cooking'], aliases: [{ alias: 'beef stock', type: 'synonym' }] }),
  item({ ...P, canonical_id: 'food.pantry.broth_stock.vegetable_broth', canonical_name: 'Vegetable Broth', default_display_name: 'Vegetable broth', subcategory: 'broth_stock', default_unit: 'carton', allowed_units: ['carton', 'can'], tags: ['pantry', 'cooking'] }),

  /* ---------------------------------- SAUCE -------------------------------- */
  item({ ...P, canonical_id: 'food.pantry.sauce.pasta_sauce', canonical_name: 'Pasta Sauce', default_display_name: 'Pasta sauce', subcategory: 'sauce', default_unit: 'jar', allowed_units: ['jar', 'can'], search_priority: 78, tags: ['dinner', 'pantry'], aliases: [{ alias: 'spaghetti sauce', type: 'synonym' }, { alias: 'marinara', type: 'synonym' }, { alias: 'tomato sauce', type: 'colloquial' }] }),
  item({ ...P, canonical_id: 'food.pantry.sauce.alfredo_sauce', canonical_name: 'Alfredo Sauce', default_display_name: 'Alfredo sauce', subcategory: 'sauce', default_unit: 'jar', allowed_units: ['jar'], tags: ['dinner', 'pantry'] }),
  item({ ...P, canonical_id: 'food.pantry.sauce.pizza_sauce', canonical_name: 'Pizza Sauce', default_display_name: 'Pizza sauce', subcategory: 'sauce', default_unit: 'jar', allowed_units: ['jar', 'can'], tags: ['pantry'] }),

  /* ------------------------------- BOXED MEALS ----------------------------- */
  item({ ...P, canonical_id: 'food.pantry.boxed_meals.mac_and_cheese', canonical_name: 'Macaroni & Cheese', default_display_name: 'Macaroni & cheese', subcategory: 'boxed_meals', default_unit: 'box', allowed_units: ['box'], search_priority: 74, tags: ['dinner', 'kids', 'pantry'], aliases: [{ alias: 'mac and cheese', type: 'synonym' }, { alias: 'kraft dinner', type: 'colloquial', locale: 'en-CA' }, { alias: 'kd', type: 'abbreviation', locale: 'en-CA' }] }),
  item({ ...P, canonical_id: 'food.pantry.boxed_meals.instant_noodles', canonical_name: 'Instant Noodles', default_display_name: 'Instant noodles', subcategory: 'boxed_meals', default_unit: 'package', allowed_units: ['package', 'pack', 'case'], tags: ['lunch', 'pantry'], aliases: [{ alias: 'ramen', type: 'colloquial' }, { alias: 'cup noodles', type: 'colloquial' }] }),
  item({ ...P, canonical_id: 'food.pantry.boxed_meals.stuffing_mix', canonical_name: 'Stuffing Mix', default_display_name: 'Stuffing mix', subcategory: 'boxed_meals', default_unit: 'box', allowed_units: ['box'], tags: ['dinner', 'holiday'] }),

  /* --------------------------------- OTHER --------------------------------- */
  item({ ...P, canonical_id: 'food.pantry.canned.applesauce', canonical_name: 'Applesauce', default_display_name: 'Applesauce', subcategory: 'canned', default_unit: 'jar', allowed_units: ['jar', 'pack'], tags: ['snack', 'kids', 'baking'] }),
  item({ ...P, canonical_id: 'food.pantry.rice_grains.breadcrumbs', canonical_name: 'Breadcrumbs', default_display_name: 'Breadcrumbs', subcategory: 'rice_grains', default_unit: 'box', allowed_units: ['box', 'bag'], tags: ['cooking', 'pantry'], aliases: [{ alias: 'bread crumbs', type: 'synonym' }] }),
  item({ ...P, canonical_id: 'food.pantry.canned.coconut_milk', canonical_name: 'Coconut Milk', default_display_name: 'Coconut milk', subcategory: 'canned', default_unit: 'can', allowed_units: ['can'], tags: ['cooking', 'pantry'] }),
]
