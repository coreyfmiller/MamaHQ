// MamaHQ Grocery — Tier-A canonical concepts (seed).
//
// A representative starter set across every department. These are CONCEPTS ("what
// is this?"), never brands/SKUs/products. Variations (boneless, 2%, size 4) are
// expressed via attributes, not new concepts. Ids are stable + hierarchical.
//
// This is a foundation, not the full ~500 — it exercises every part of the model
// (parent/child concepts, aliases with types/locales, tags, concept attributes,
// all departments) and encodes the two semantic test cases:
//   * cilantro vs coriander_seed must NOT merge (§13)
//   * no brand/SKU concepts (§14)

import type { CanonicalItem } from './types.ts'

// Compact helper: fills the repetitive defaults so each concept reads clearly.
type Seed = Omit<CanonicalItem, 'search_priority' | 'catalog_tier' | 'status' | 'version' | 'added_in' | 'aliases' | 'tags' | 'attributes' | 'concept_level' | 'parent_concept_id'> &
  Partial<Pick<CanonicalItem, 'search_priority' | 'concept_level' | 'parent_concept_id' | 'aliases' | 'tags' | 'attributes'>>

function item(s: Seed): CanonicalItem {
  return {
    concept_level: 'specific',
    parent_concept_id: null,
    search_priority: 50,
    catalog_tier: 'A',
    status: 'active',
    version: 1,
    added_in: 'tierA.v1',
    aliases: [],
    tags: [],
    attributes: [],
    ...s,
  }
}

export const ITEMS: CanonicalItem[] = [
  /* ------------------------------- FOOD · PRODUCE ------------------------------- */
  item({
    canonical_id: 'food.produce.fruit.banana',
    canonical_name: 'Banana',
    default_display_name: 'Bananas',
    department: 'food', category: 'produce', subcategory: 'fruit',
    shopping_category: 'produce', default_unit: 'each', allowed_units: ['each', 'bunch', 'lb', 'kg'],
    storage_type: 'ambient', search_priority: 90,
    tags: ['fruit', 'breakfast', 'snack', 'school_lunch', 'smoothie', 'baking'],
  }),
  item({
    canonical_id: 'food.produce.fruit.apple',
    canonical_name: 'Apple',
    default_display_name: 'Apples',
    department: 'food', category: 'produce', subcategory: 'fruit',
    shopping_category: 'produce', default_unit: 'each', allowed_units: ['each', 'lb', 'kg', 'bag'],
    storage_type: 'refrigerated', search_priority: 85,
    tags: ['fruit', 'snack', 'school_lunch', 'baking'],
    attributes: [{ attribute_id: 'apple.variety' }],
  }),
  item({
    canonical_id: 'food.produce.fruit.strawberry',
    canonical_name: 'Strawberry',
    default_display_name: 'Strawberries',
    department: 'food', category: 'produce', subcategory: 'fruit',
    shopping_category: 'produce', default_unit: 'package', allowed_units: ['package', 'lb', 'each'],
    storage_type: 'refrigerated',
    tags: ['fruit', 'snack', 'smoothie'],
    aliases: [{ alias: 'strawberries', type: 'synonym' }],
  }),
  item({
    canonical_id: 'food.produce.vegetable.potato',
    canonical_name: 'Potato',
    default_display_name: 'Potatoes',
    department: 'food', category: 'produce', subcategory: 'vegetable',
    shopping_category: 'produce', default_unit: 'lb', allowed_units: ['lb', 'kg', 'each', 'bag'],
    storage_type: 'ambient', search_priority: 80,
    tags: ['vegetable', 'dinner'],
  }),
  item({
    canonical_id: 'food.produce.vegetable.green_onion',
    canonical_name: 'Green Onion',
    default_display_name: 'Green onions',
    department: 'food', category: 'produce', subcategory: 'vegetable',
    shopping_category: 'produce', default_unit: 'bunch', allowed_units: ['bunch', 'each'],
    storage_type: 'refrigerated',
    tags: ['vegetable', 'garnish'],
    aliases: [
      { alias: 'scallion', type: 'synonym' },
      { alias: 'scallions', type: 'synonym' },
      { alias: 'spring onion', type: 'regional' },
      { alias: 'spring onions', type: 'regional' },
    ],
  }),
  item({
    canonical_id: 'food.produce.vegetable.bell_pepper',
    canonical_name: 'Bell Pepper',
    default_display_name: 'Bell peppers',
    department: 'food', category: 'produce', subcategory: 'vegetable',
    shopping_category: 'produce', default_unit: 'each', allowed_units: ['each', 'lb'],
    storage_type: 'refrigerated',
    tags: ['vegetable'],
    aliases: [{ alias: 'sweet pepper', type: 'synonym' }],
    attributes: [{ attribute_id: 'bell_pepper.colour' }],
  }),
  // §13 CORIANDER RULE — fresh leaf = cilantro (its own concept), aliases "fresh coriander".
  item({
    canonical_id: 'food.produce.fresh_herbs.cilantro',
    canonical_name: 'Cilantro',
    default_display_name: 'Cilantro',
    department: 'food', category: 'produce', subcategory: 'fresh_herbs',
    shopping_category: 'produce', default_unit: 'bunch', allowed_units: ['bunch', 'each'],
    storage_type: 'refrigerated',
    tags: ['herb', 'fresh'],
    aliases: [
      { alias: 'fresh coriander', type: 'regional' },
      { alias: 'coriander leaves', type: 'regional' },
      { alias: 'chinese parsley', type: 'colloquial' },
    ],
  }),

  /* --------------------------- FOOD · MEAT & SEAFOOD --------------------------- */
  item({
    canonical_id: 'food.meat_seafood.beef.ground_beef',
    canonical_name: 'Ground Beef',
    default_display_name: 'Ground beef',
    department: 'food', category: 'meat_seafood', subcategory: 'beef',
    shopping_category: 'meat_seafood', default_unit: 'lb', allowed_units: ['lb', 'kg', 'g', 'package'],
    storage_type: 'refrigerated', search_priority: 85,
    tags: ['protein', 'dinner'],
    aliases: [
      { alias: 'hamburger', type: 'colloquial' },
      { alias: 'hamburger meat', type: 'colloquial' },
      { alias: 'minced beef', type: 'regional' },
    ],
  }),
  // Generic parent concept: Chicken.
  item({
    canonical_id: 'food.meat_seafood.poultry.chicken',
    canonical_name: 'Chicken',
    default_display_name: 'Chicken',
    department: 'food', category: 'meat_seafood', subcategory: 'poultry',
    shopping_category: 'meat_seafood', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package', 'each'],
    storage_type: 'refrigerated', concept_level: 'generic', search_priority: 70,
    tags: ['protein', 'dinner'],
  }),
  item({
    canonical_id: 'food.meat_seafood.poultry.chicken_breast',
    canonical_name: 'Chicken Breast',
    default_display_name: 'Chicken breasts',
    department: 'food', category: 'meat_seafood', subcategory: 'poultry',
    shopping_category: 'meat_seafood', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'],
    storage_type: 'refrigerated', parent_concept_id: 'food.meat_seafood.poultry.chicken', search_priority: 82,
    tags: ['protein', 'dinner'],
    attributes: [{ attribute_id: 'chicken.cut_bone' }, { attribute_id: 'chicken.skin' }],
  }),
  item({
    canonical_id: 'food.meat_seafood.poultry.chicken_thighs',
    canonical_name: 'Chicken Thighs',
    default_display_name: 'Chicken thighs',
    department: 'food', category: 'meat_seafood', subcategory: 'poultry',
    shopping_category: 'meat_seafood', default_unit: 'lb', allowed_units: ['lb', 'kg', 'package'],
    storage_type: 'refrigerated', parent_concept_id: 'food.meat_seafood.poultry.chicken',
    tags: ['protein', 'dinner'],
    attributes: [{ attribute_id: 'chicken.cut_bone' }, { attribute_id: 'chicken.skin' }],
  }),

  /* ---------------------------- FOOD · DAIRY & EGGS ---------------------------- */
  item({
    canonical_id: 'food.dairy_eggs.milk.milk',
    canonical_name: 'Milk',
    default_display_name: 'Milk',
    department: 'food', category: 'dairy_eggs', subcategory: 'milk',
    shopping_category: 'dairy_eggs', default_unit: 'L', allowed_units: ['L', 'mL', 'carton', 'each'],
    storage_type: 'refrigerated', search_priority: 95,
    tags: ['breakfast', 'staple'],
    attributes: [{ attribute_id: 'milk.fat_percentage', typical: true }, { attribute_id: 'milk.lactose_free' }],
  }),
  // Generic parent: Cheese.
  item({
    canonical_id: 'food.dairy_eggs.cheese.cheese',
    canonical_name: 'Cheese',
    default_display_name: 'Cheese',
    department: 'food', category: 'dairy_eggs', subcategory: 'cheese',
    shopping_category: 'dairy_eggs', default_unit: 'package', allowed_units: ['package', 'g', 'kg'],
    storage_type: 'refrigerated', concept_level: 'generic', search_priority: 70,
    tags: ['staple'],
  }),
  item({
    canonical_id: 'food.dairy_eggs.cheese.cheddar_cheese',
    canonical_name: 'Cheddar Cheese',
    default_display_name: 'Cheddar cheese',
    department: 'food', category: 'dairy_eggs', subcategory: 'cheese',
    shopping_category: 'dairy_eggs', default_unit: 'package', allowed_units: ['package', 'g', 'kg'],
    storage_type: 'refrigerated', parent_concept_id: 'food.dairy_eggs.cheese.cheese', search_priority: 78,
    tags: ['snack', 'sandwich'],
    aliases: [{ alias: 'marble cheese', type: 'colloquial' }],
  }),
  item({
    canonical_id: 'food.dairy_eggs.cheese.mozzarella_cheese',
    canonical_name: 'Mozzarella Cheese',
    default_display_name: 'Mozzarella cheese',
    department: 'food', category: 'dairy_eggs', subcategory: 'cheese',
    shopping_category: 'dairy_eggs', default_unit: 'package', allowed_units: ['package', 'g', 'kg'],
    storage_type: 'refrigerated', parent_concept_id: 'food.dairy_eggs.cheese.cheese',
    tags: ['pizza', 'pasta'],
  }),
  item({
    canonical_id: 'food.dairy_eggs.eggs.eggs',
    canonical_name: 'Eggs',
    default_display_name: 'Eggs',
    department: 'food', category: 'dairy_eggs', subcategory: 'eggs',
    shopping_category: 'dairy_eggs', default_unit: 'dozen', allowed_units: ['dozen', 'each', 'carton'],
    storage_type: 'refrigerated', search_priority: 92,
    tags: ['breakfast', 'staple', 'baking'],
    attributes: [{ attribute_id: 'eggs.size' }],
  }),
  item({
    canonical_id: 'food.dairy_eggs.butter.butter',
    canonical_name: 'Butter',
    default_display_name: 'Butter',
    department: 'food', category: 'dairy_eggs', subcategory: 'butter',
    shopping_category: 'dairy_eggs', default_unit: 'lb', allowed_units: ['lb', 'g', 'package'],
    storage_type: 'refrigerated', tags: ['baking', 'staple'],
  }),
  item({
    canonical_id: 'food.dairy_eggs.yogurt.yogurt',
    canonical_name: 'Yogurt',
    default_display_name: 'Yogurt',
    department: 'food', category: 'dairy_eggs', subcategory: 'yogurt',
    shopping_category: 'dairy_eggs', default_unit: 'tub', allowed_units: ['tub', 'each', 'pack', 'g'],
    storage_type: 'refrigerated', tags: ['breakfast', 'snack'],
    aliases: [{ alias: 'yoghurt', type: 'regional' }],
  }),

  /* -------------------------------- FOOD · BAKERY ------------------------------ */
  item({
    canonical_id: 'food.bakery.bread',
    canonical_name: 'Bread',
    default_display_name: 'Bread',
    department: 'food', category: 'bakery',
    shopping_category: 'bakery', default_unit: 'loaf', allowed_units: ['loaf', 'each', 'bag'],
    storage_type: 'ambient', search_priority: 90,
    tags: ['breakfast', 'sandwich', 'staple'],
    attributes: [{ attribute_id: 'bread.style' }],
  }),

  /* -------------------------------- FOOD · PANTRY ------------------------------ */
  item({
    canonical_id: 'food.pantry.pasta.pasta',
    canonical_name: 'Pasta',
    default_display_name: 'Pasta',
    department: 'food', category: 'pantry', subcategory: 'pasta',
    shopping_category: 'pantry', default_unit: 'box', allowed_units: ['box', 'bag', 'g'],
    storage_type: 'ambient', tags: ['dinner', 'staple'],
    aliases: [{ alias: 'noodles', type: 'colloquial' }],
  }),
  item({
    canonical_id: 'food.pantry.rice_grains.rice',
    canonical_name: 'Rice',
    default_display_name: 'Rice',
    department: 'food', category: 'pantry', subcategory: 'rice_grains',
    shopping_category: 'pantry', default_unit: 'bag', allowed_units: ['bag', 'kg', 'lb', 'box'],
    storage_type: 'ambient', tags: ['dinner', 'staple'],
  }),
  item({
    canonical_id: 'food.pantry.legumes.chickpeas',
    canonical_name: 'Chickpeas',
    default_display_name: 'Chickpeas',
    department: 'food', category: 'pantry', subcategory: 'legumes',
    shopping_category: 'pantry', default_unit: 'can', allowed_units: ['can', 'bag'],
    storage_type: 'ambient', tags: ['protein', 'pantry'],
    aliases: [
      { alias: 'garbanzo beans', type: 'synonym' },
      { alias: 'garbanzos', type: 'synonym' },
    ],
  }),
  item({
    canonical_id: 'food.pantry.canned.canned_tomatoes',
    canonical_name: 'Canned Tomatoes',
    default_display_name: 'Canned tomatoes',
    department: 'food', category: 'pantry', subcategory: 'canned',
    shopping_category: 'pantry', default_unit: 'can', allowed_units: ['can'],
    storage_type: 'ambient', tags: ['pantry', 'cooking'],
  }),

  /* ------------------------ FOOD · CONDIMENTS & SAUCES ------------------------- */
  item({
    canonical_id: 'food.condiments_sauces.ketchup',
    canonical_name: 'Ketchup',
    default_display_name: 'Ketchup',
    department: 'food', category: 'condiments_sauces',
    shopping_category: 'pantry', default_unit: 'bottle', allowed_units: ['bottle', 'mL'],
    storage_type: 'ambient', tags: ['condiment'],
  }),

  /* -------------------------------- FOOD · BAKING ------------------------------ */
  item({
    canonical_id: 'food.baking.flour.all_purpose_flour',
    canonical_name: 'All-Purpose Flour',
    default_display_name: 'Flour',
    department: 'food', category: 'baking', subcategory: 'flour',
    shopping_category: 'pantry', default_unit: 'bag', allowed_units: ['bag', 'kg', 'lb'],
    storage_type: 'ambient', tags: ['baking', 'staple'],
    aliases: [{ alias: 'flour', type: 'colloquial' }, { alias: 'ap flour', type: 'abbreviation' }],
  }),
  item({
    canonical_id: 'food.baking.sugar.powdered_sugar',
    canonical_name: 'Powdered Sugar',
    default_display_name: 'Powdered sugar',
    department: 'food', category: 'baking', subcategory: 'sugar',
    shopping_category: 'pantry', default_unit: 'bag', allowed_units: ['bag', 'kg'],
    storage_type: 'ambient', tags: ['baking'],
    aliases: [
      { alias: 'icing sugar', type: 'regional', locale: 'en-CA' },
      { alias: 'confectioners sugar', type: 'regional', locale: 'en-US' },
      { alias: "confectioner's sugar", type: 'regional', locale: 'en-US' },
    ],
  }),

  /* --------------------- FOOD · HERBS / SPICES / SEASONINGS -------------------- */
  // §13 CORIANDER RULE — the SEED is a separate spice concept; must NOT merge with cilantro.
  item({
    canonical_id: 'food.herbs_spices_seasonings.spice.coriander_seed',
    canonical_name: 'Coriander Seed',
    default_display_name: 'Coriander seed',
    department: 'food', category: 'herbs_spices_seasonings', subcategory: 'spice',
    shopping_category: 'pantry', default_unit: 'jar', allowed_units: ['jar', 'g', 'package'],
    storage_type: 'ambient', tags: ['spice'],
    aliases: [{ alias: 'ground coriander', type: 'synonym' }],
  }),
  item({
    canonical_id: 'food.herbs_spices_seasonings.salt.salt',
    canonical_name: 'Salt',
    default_display_name: 'Salt',
    department: 'food', category: 'herbs_spices_seasonings', subcategory: 'salt',
    shopping_category: 'pantry', default_unit: 'box', allowed_units: ['box', 'g', 'kg'],
    storage_type: 'ambient', tags: ['seasoning', 'staple'],
  }),

  /* ------------------------------- FOOD · FROZEN ------------------------------- */
  item({
    canonical_id: 'food.frozen.frozen_peas',
    canonical_name: 'Frozen Peas',
    default_display_name: 'Frozen peas',
    department: 'food', category: 'frozen',
    shopping_category: 'frozen', default_unit: 'bag', allowed_units: ['bag', 'g'],
    storage_type: 'frozen', tags: ['vegetable', 'freezer'],
  }),

  /* ------------------------------ FOOD · BREAKFAST ----------------------------- */
  item({
    canonical_id: 'food.breakfast.cereal',
    canonical_name: 'Cereal',
    default_display_name: 'Cereal',
    department: 'food', category: 'breakfast',
    shopping_category: 'breakfast', default_unit: 'box', allowed_units: ['box', 'bag'],
    storage_type: 'ambient', tags: ['breakfast'],
  }),

  /* ------------------------------- FOOD · SNACKS ------------------------------- */
  item({
    canonical_id: 'food.snacks.granola_bars',
    canonical_name: 'Granola Bars',
    default_display_name: 'Granola bars',
    department: 'food', category: 'snacks',
    shopping_category: 'snacks', default_unit: 'box', allowed_units: ['box', 'pack'],
    storage_type: 'ambient', tags: ['snack', 'school_lunch'],
  }),

  /* --------------------- FOOD · NUT BUTTERS / JAMS / SPREADS ------------------- */
  item({
    canonical_id: 'food.nut_butters_jams_spreads.peanut_butter',
    canonical_name: 'Peanut Butter',
    default_display_name: 'Peanut butter',
    department: 'food', category: 'nut_butters_jams_spreads',
    shopping_category: 'pantry', default_unit: 'jar', allowed_units: ['jar', 'g'],
    storage_type: 'ambient', tags: ['sandwich', 'snack', 'staple'],
    aliases: [{ alias: 'pb', type: 'abbreviation' }],
  }),

  /* ------------------------------ FOOD · BEVERAGES ----------------------------- */
  item({
    canonical_id: 'food.beverages.soft_drink.soda',
    canonical_name: 'Soda',
    default_display_name: 'Soda',
    department: 'food', category: 'beverages', subcategory: 'soft_drink',
    shopping_category: 'beverages', default_unit: 'bottle', allowed_units: ['bottle', 'can', 'case', 'L'],
    storage_type: 'ambient', tags: ['drink'],
    aliases: [
      { alias: 'pop', type: 'regional', locale: 'en-CA' },
      { alias: 'soft drink', type: 'synonym' },
      { alias: 'soda pop', type: 'colloquial' },
    ],
  }),
  item({
    canonical_id: 'food.beverages.water.bottled_water',
    canonical_name: 'Bottled Water',
    default_display_name: 'Bottled water',
    department: 'food', category: 'beverages', subcategory: 'water',
    shopping_category: 'beverages', default_unit: 'case', allowed_units: ['case', 'bottle', 'L'],
    storage_type: 'ambient', tags: ['drink', 'staple'],
  }),

  /* ------------------------------ FOOD · COFFEE & TEA -------------------------- */
  item({
    canonical_id: 'food.coffee_tea.coffee.coffee',
    canonical_name: 'Coffee',
    default_display_name: 'Coffee',
    department: 'food', category: 'coffee_tea', subcategory: 'coffee',
    shopping_category: 'beverages', default_unit: 'bag', allowed_units: ['bag', 'box', 'g', 'can'],
    storage_type: 'ambient', search_priority: 80,
    tags: ['drink', 'staple'],
    attributes: [{ attribute_id: 'coffee.roast' }, { attribute_id: 'coffee.format', typical: true }],
  }),

  /* ---------------------------------- BABY ------------------------------------ */
  item({
    canonical_id: 'baby.diapering.disposable_diapers',
    canonical_name: 'Disposable Diapers',
    default_display_name: 'Diapers',
    department: 'baby', category: 'diapering', subcategory: 'diapers',
    shopping_category: 'baby', default_unit: 'pack', allowed_units: ['pack', 'box', 'case'],
    storage_type: 'nonfood', search_priority: 88,
    tags: ['baby', 'staple'],
    aliases: [{ alias: 'diapers', type: 'colloquial' }, { alias: 'nappies', type: 'regional' }],
    attributes: [{ attribute_id: 'diapers.diaper_size', typical: true }, { attribute_id: 'diapers.style' }],
  }),
  item({
    canonical_id: 'baby.diapering.baby_wipes',
    canonical_name: 'Baby Wipes',
    default_display_name: 'Baby wipes',
    department: 'baby', category: 'diapering', subcategory: 'wipes',
    shopping_category: 'baby', default_unit: 'pack', allowed_units: ['pack', 'box', 'case'],
    storage_type: 'nonfood', search_priority: 80,
    tags: ['baby', 'staple'],
    aliases: [{ alias: 'wipes', type: 'colloquial' }],
  }),
  item({
    canonical_id: 'baby.feeding.infant_formula',
    canonical_name: 'Infant Formula',
    default_display_name: 'Formula',
    department: 'baby', category: 'feeding',
    shopping_category: 'baby', default_unit: 'can', allowed_units: ['can', 'tub', 'box'],
    storage_type: 'nonfood', search_priority: 82,
    tags: ['baby', 'staple'],
    aliases: [{ alias: 'formula', type: 'colloquial' }, { alias: 'baby formula', type: 'synonym' }],
  }),

  /* -------------------------------- HOUSEHOLD --------------------------------- */
  item({
    canonical_id: 'household.paper.toilet_paper',
    canonical_name: 'Toilet Paper',
    default_display_name: 'Toilet paper',
    department: 'household', category: 'paper', subcategory: 'toilet_paper',
    shopping_category: 'household', default_unit: 'pack', allowed_units: ['pack', 'roll', 'case'],
    storage_type: 'nonfood', search_priority: 90,
    tags: ['household', 'staple'],
    aliases: [{ alias: 'tp', type: 'abbreviation' }, { alias: 'bathroom tissue', type: 'synonym' }],
  }),
  item({
    canonical_id: 'household.paper.paper_towel',
    canonical_name: 'Paper Towel',
    default_display_name: 'Paper towels',
    department: 'household', category: 'paper', subcategory: 'paper_towel',
    shopping_category: 'household', default_unit: 'pack', allowed_units: ['pack', 'roll', 'case'],
    storage_type: 'nonfood', tags: ['household', 'staple'],
  }),
  item({
    canonical_id: 'household.dishwashing.dish_soap',
    canonical_name: 'Dish Soap',
    default_display_name: 'Dish soap',
    department: 'household', category: 'dishwashing',
    shopping_category: 'household', default_unit: 'bottle', allowed_units: ['bottle', 'mL'],
    storage_type: 'nonfood', tags: ['household', 'cleaning'],
    aliases: [{ alias: 'dishwashing liquid', type: 'synonym' }],
  }),
  item({
    canonical_id: 'household.laundry.laundry_detergent',
    canonical_name: 'Laundry Detergent',
    default_display_name: 'Laundry detergent',
    department: 'household', category: 'laundry',
    shopping_category: 'household', default_unit: 'bottle', allowed_units: ['bottle', 'box', 'pack'],
    storage_type: 'nonfood', tags: ['household', 'cleaning'],
    aliases: [{ alias: 'detergent', type: 'colloquial' }],
  }),

  /* ------------------------------ PERSONAL CARE ------------------------------- */
  item({
    canonical_id: 'personal_care.oral.toothpaste',
    canonical_name: 'Toothpaste',
    default_display_name: 'Toothpaste',
    department: 'personal_care', category: 'oral',
    shopping_category: 'personal_care', default_unit: 'each', allowed_units: ['each', 'pack'],
    storage_type: 'nonfood', tags: ['personal_care', 'staple'],
  }),
  item({
    canonical_id: 'personal_care.hair.shampoo',
    canonical_name: 'Shampoo',
    default_display_name: 'Shampoo',
    department: 'personal_care', category: 'hair',
    shopping_category: 'personal_care', default_unit: 'bottle', allowed_units: ['bottle', 'mL'],
    storage_type: 'nonfood', tags: ['personal_care'],
  }),

  /* ----------------------------- HEALTH & WELLNESS ---------------------------- */
  item({
    canonical_id: 'health_wellness.otc_medicine.acetaminophen',
    canonical_name: 'Acetaminophen',
    default_display_name: 'Acetaminophen',
    department: 'health_wellness', category: 'otc_medicine',
    shopping_category: 'health', default_unit: 'box', allowed_units: ['box', 'bottle', 'pack'],
    storage_type: 'nonfood', tags: ['medicine'],
    aliases: [
      { alias: 'tylenol', type: 'colloquial' }, // common colloquial term, not a catalog brand concept
      { alias: 'paracetamol', type: 'regional' },
    ],
  }),

  /* ------------------------------------ PET ----------------------------------- */
  item({
    canonical_id: 'pet.dog.dog_food',
    canonical_name: 'Dog Food',
    default_display_name: 'Dog food',
    department: 'pet', category: 'dog',
    shopping_category: 'pet', default_unit: 'bag', allowed_units: ['bag', 'can', 'case', 'kg'],
    storage_type: 'nonfood', tags: ['pet', 'staple'],
  }),

  /* ---------------------- HOME / KITCHEN CONSUMABLES -------------------------- */
  item({
    canonical_id: 'home_kitchen_consumables.wraps_foil.aluminum_foil',
    canonical_name: 'Aluminum Foil',
    default_display_name: 'Aluminum foil',
    department: 'home_kitchen_consumables', category: 'wraps_foil',
    shopping_category: 'household', default_unit: 'box', allowed_units: ['box', 'roll'],
    storage_type: 'nonfood', tags: ['kitchen'],
    aliases: [{ alias: 'tin foil', type: 'colloquial' }, { alias: 'aluminium foil', type: 'regional' }],
  }),
]
