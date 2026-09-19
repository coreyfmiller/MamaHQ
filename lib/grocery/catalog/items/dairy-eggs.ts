import type { CanonicalItem } from '../types.ts'
import { item } from './_helper.ts'

const D = { department: 'food', category: 'dairy_eggs', shopping_category: 'dairy_eggs', storage_type: 'refrigerated' } as const

export const DAIRY_EGGS: CanonicalItem[] = [
  /* ---------------------------------- MILK --------------------------------- */
  item({ ...D, canonical_id: 'food.dairy_eggs.milk.milk', canonical_name: 'Milk', default_display_name: 'Milk', subcategory: 'milk', default_unit: 'L', allowed_units: ['L', 'mL', 'carton', 'each'], search_priority: 95, tags: ['breakfast', 'staple'], attributes: [{ attribute_id: 'milk.fat_percentage', typical: true }, { attribute_id: 'milk.lactose_free' }] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.milk.chocolate_milk', canonical_name: 'Chocolate Milk', default_display_name: 'Chocolate milk', subcategory: 'milk', default_unit: 'carton', allowed_units: ['carton', 'L', 'mL'], tags: ['snack', 'kids'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.dairy_alt.almond_milk', canonical_name: 'Almond Milk', default_display_name: 'Almond milk', subcategory: 'dairy_alt', default_unit: 'carton', allowed_units: ['carton', 'L'], tags: ['dairy_free'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.dairy_alt.oat_milk', canonical_name: 'Oat Milk', default_display_name: 'Oat milk', subcategory: 'dairy_alt', default_unit: 'carton', allowed_units: ['carton', 'L'], tags: ['dairy_free'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.dairy_alt.soy_milk', canonical_name: 'Soy Milk', default_display_name: 'Soy milk', subcategory: 'dairy_alt', default_unit: 'carton', allowed_units: ['carton', 'L'], tags: ['dairy_free'] }),

  /* --------------------------------- CHEESE -------------------------------- */
  item({ ...D, canonical_id: 'food.dairy_eggs.cheese.cheese', canonical_name: 'Cheese', default_display_name: 'Cheese', subcategory: 'cheese', concept_level: 'generic', default_unit: 'package', allowed_units: ['package', 'g', 'kg'], search_priority: 70, tags: ['staple'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cheese.cheddar_cheese', canonical_name: 'Cheddar Cheese', default_display_name: 'Cheddar cheese', subcategory: 'cheese', parent_concept_id: 'food.dairy_eggs.cheese.cheese', default_unit: 'package', allowed_units: ['package', 'g', 'kg'], search_priority: 78, tags: ['snack', 'sandwich'], aliases: [{ alias: 'marble cheese', type: 'colloquial' }] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cheese.mozzarella_cheese', canonical_name: 'Mozzarella Cheese', default_display_name: 'Mozzarella cheese', subcategory: 'cheese', parent_concept_id: 'food.dairy_eggs.cheese.cheese', default_unit: 'package', allowed_units: ['package', 'g', 'kg'], tags: ['pizza', 'pasta'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cheese.parmesan_cheese', canonical_name: 'Parmesan Cheese', default_display_name: 'Parmesan cheese', subcategory: 'cheese', parent_concept_id: 'food.dairy_eggs.cheese.cheese', default_unit: 'package', allowed_units: ['package', 'g'], tags: ['pasta', 'cooking'], aliases: [{ alias: 'parmesan', type: 'colloquial' }, { alias: 'parmigiano', type: 'synonym' }] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cheese.cream_cheese', canonical_name: 'Cream Cheese', default_display_name: 'Cream cheese', subcategory: 'cheese', parent_concept_id: 'food.dairy_eggs.cheese.cheese', default_unit: 'package', allowed_units: ['package', 'tub', 'g'], tags: ['breakfast', 'spread'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cheese.feta_cheese', canonical_name: 'Feta Cheese', default_display_name: 'Feta cheese', subcategory: 'cheese', parent_concept_id: 'food.dairy_eggs.cheese.cheese', default_unit: 'package', allowed_units: ['package', 'tub', 'g'], tags: ['salad', 'cooking'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cheese.swiss_cheese', canonical_name: 'Swiss Cheese', default_display_name: 'Swiss cheese', subcategory: 'cheese', parent_concept_id: 'food.dairy_eggs.cheese.cheese', default_unit: 'package', allowed_units: ['package', 'g'], tags: ['sandwich'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cheese.sliced_cheese', canonical_name: 'Sliced Cheese', default_display_name: 'Sliced cheese', subcategory: 'cheese', parent_concept_id: 'food.dairy_eggs.cheese.cheese', default_unit: 'package', allowed_units: ['package'], tags: ['sandwich', 'kids'], aliases: [{ alias: 'cheese slices', type: 'synonym' }] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cheese.shredded_cheese', canonical_name: 'Shredded Cheese', default_display_name: 'Shredded cheese', subcategory: 'cheese', parent_concept_id: 'food.dairy_eggs.cheese.cheese', default_unit: 'bag', allowed_units: ['bag', 'package', 'g'], search_priority: 74, tags: ['cooking', 'pasta'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cheese.cottage_cheese', canonical_name: 'Cottage Cheese', default_display_name: 'Cottage cheese', subcategory: 'cheese', default_unit: 'tub', allowed_units: ['tub', 'g'], tags: ['snack'] }),

  /* --------------------------------- YOGURT -------------------------------- */
  item({ ...D, canonical_id: 'food.dairy_eggs.yogurt.yogurt', canonical_name: 'Yogurt', default_display_name: 'Yogurt', subcategory: 'yogurt', default_unit: 'tub', allowed_units: ['tub', 'each', 'pack', 'g'], search_priority: 78, tags: ['breakfast', 'snack'], aliases: [{ alias: 'yoghurt', type: 'regional' }], attributes: [{ attribute_id: 'yogurt.style' }] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.yogurt.greek_yogurt', canonical_name: 'Greek Yogurt', default_display_name: 'Greek yogurt', subcategory: 'yogurt', parent_concept_id: 'food.dairy_eggs.yogurt.yogurt', default_unit: 'tub', allowed_units: ['tub', 'pack', 'g'], tags: ['breakfast', 'snack', 'protein'], attributes: [{ attribute_id: 'yogurt.style' }] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.yogurt.kids_yogurt', canonical_name: 'Kids Yogurt', default_display_name: 'Kids yogurt', subcategory: 'yogurt', parent_concept_id: 'food.dairy_eggs.yogurt.yogurt', default_unit: 'pack', allowed_units: ['pack', 'box'], tags: ['snack', 'kids', 'school_lunch'], aliases: [{ alias: 'yogurt tubes', type: 'colloquial' }, { alias: 'go-gurt', type: 'colloquial' }] }),

  /* ---------------------------------- EGGS --------------------------------- */
  item({ ...D, canonical_id: 'food.dairy_eggs.eggs.eggs', canonical_name: 'Eggs', default_display_name: 'Eggs', subcategory: 'eggs', default_unit: 'dozen', allowed_units: ['dozen', 'each', 'carton'], search_priority: 92, tags: ['breakfast', 'staple', 'baking'], attributes: [{ attribute_id: 'eggs.size' }] }),

  /* --------------------------------- BUTTER -------------------------------- */
  item({ ...D, canonical_id: 'food.dairy_eggs.butter.butter', canonical_name: 'Butter', default_display_name: 'Butter', subcategory: 'butter', default_unit: 'lb', allowed_units: ['lb', 'g', 'package'], search_priority: 82, tags: ['baking', 'staple'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.butter.margarine', canonical_name: 'Margarine', default_display_name: 'Margarine', subcategory: 'butter', default_unit: 'tub', allowed_units: ['tub', 'package'], tags: ['spread'] }),

  /* ---------------------------------- CREAM -------------------------------- */
  item({ ...D, canonical_id: 'food.dairy_eggs.cream.heavy_cream', canonical_name: 'Heavy Cream', default_display_name: 'Heavy cream', subcategory: 'cream', default_unit: 'carton', allowed_units: ['carton', 'mL'], tags: ['baking', 'cooking'], aliases: [{ alias: 'whipping cream', type: 'synonym' }, { alias: '35% cream', type: 'regional', locale: 'en-CA' }] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cream.half_and_half', canonical_name: 'Half-and-Half', default_display_name: 'Half-and-half', subcategory: 'cream', default_unit: 'carton', allowed_units: ['carton', 'mL'], tags: ['coffee'], aliases: [{ alias: 'coffee cream', type: 'regional', locale: 'en-CA' }, { alias: '10% cream', type: 'regional', locale: 'en-CA' }] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cream.sour_cream', canonical_name: 'Sour Cream', default_display_name: 'Sour cream', subcategory: 'cream', default_unit: 'tub', allowed_units: ['tub', 'g'], tags: ['cooking', 'topping'] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.cream.whipped_cream', canonical_name: 'Whipped Cream', default_display_name: 'Whipped cream', subcategory: 'cream', default_unit: 'each', allowed_units: ['each', 'can'], tags: ['dessert', 'topping'] }),

  /* --------------------------- REFRIGERATED DOUGH -------------------------- */
  item({ ...D, canonical_id: 'food.dairy_eggs.refrigerated_dough.biscuit_dough', canonical_name: 'Biscuit Dough', default_display_name: 'Biscuit dough', subcategory: 'refrigerated_dough', default_unit: 'can', allowed_units: ['can', 'package'], tags: ['baking', 'breakfast'], aliases: [{ alias: 'refrigerated biscuits', type: 'synonym' }] }),
  item({ ...D, canonical_id: 'food.dairy_eggs.refrigerated_dough.cookie_dough', canonical_name: 'Cookie Dough', default_display_name: 'Cookie dough', subcategory: 'refrigerated_dough', default_unit: 'package', allowed_units: ['package', 'tub'], tags: ['baking', 'dessert'] }),
]
