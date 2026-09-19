// MamaHQ Grocery — internal taxonomy: Department → Category → Subcategory.
// This answers "what IS this?" and is deliberately DISTINCT from shopping_category
// ("where would I find it while shopping?") and tags ("why/how a household uses it").
//
// Not every department needs deep subcategories — we use useful shopping semantics,
// not taxonomy for its own sake. Subcategories are optional per concept.

export const DEPARTMENTS = [
  'food',
  'baby',
  'household',
  'personal_care',
  'health_wellness',
  'pet',
  'party_occasions',
  'school_lunch',
  'home_kitchen_consumables',
  'other',
] as const
export type Department = (typeof DEPARTMENTS)[number]

// Categories allowed within each department. Food is the deep one (per the spec);
// most others stay shallow on purpose.
export const CATEGORIES_BY_DEPARTMENT: Record<Department, readonly string[]> = {
  food: [
    'produce',
    'meat_seafood',
    'dairy_eggs',
    'bakery',
    'deli',
    'frozen',
    'pantry',
    'breakfast',
    'snacks',
    'candy',
    'condiments_sauces',
    'baking',
    'herbs_spices_seasonings',
    'oils_cooking_fats',
    'nut_butters_jams_spreads',
    'international_foods',
    'beverages',
    'coffee_tea',
  ],
  baby: ['diapering', 'feeding', 'baby_food', 'bath_care', 'health'],
  household: ['paper', 'cleaning', 'laundry', 'dishwashing', 'storage_bags', 'trash'],
  personal_care: ['hair', 'skin', 'oral', 'shaving', 'deodorant', 'feminine_care', 'bath_body'],
  health_wellness: ['otc_medicine', 'vitamins_supplements', 'first_aid'],
  pet: ['dog', 'cat', 'other_pet'],
  party_occasions: ['party_supplies', 'greeting'],
  school_lunch: ['lunch'],
  home_kitchen_consumables: ['wraps_foil', 'batteries', 'candles_matches'],
  other: ['misc'],
} as const

// Optional subcategories, keyed by "department.category". Only where they add real
// shopping meaning. A concept's subcategory (if set) must appear in the list for its
// department.category (validated in validate.ts).
export const SUBCATEGORIES: Record<string, readonly string[]> = {
  'food.produce': ['fruit', 'vegetable', 'fresh_herbs', 'salad'],
  'food.meat_seafood': ['beef', 'poultry', 'pork', 'seafood', 'plant_protein'],
  'food.dairy_eggs': ['milk', 'cheese', 'yogurt', 'butter', 'eggs', 'cream'],
  'food.pantry': ['pasta', 'rice_grains', 'canned', 'legumes', 'soup', 'cereal_pantry'],
  'food.baking': ['flour', 'sugar', 'leavening', 'baking_add_ins'],
  'food.herbs_spices_seasonings': ['spice', 'seasoning', 'salt'],
  'food.beverages': ['water', 'juice', 'soft_drink', 'sports_energy'],
  'food.coffee_tea': ['coffee', 'tea'],
  'baby.diapering': ['diapers', 'wipes'],
  'household.paper': ['toilet_paper', 'paper_towel', 'tissue'],
} as const
