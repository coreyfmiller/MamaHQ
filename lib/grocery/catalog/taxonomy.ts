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
  'food.produce': ['fruit', 'vegetable', 'leafy_greens', 'fresh_herbs', 'salad', 'prepared_produce'],
  'food.meat_seafood': ['beef', 'poultry', 'pork', 'lamb', 'seafood', 'processed_meat', 'plant_protein'],
  'food.dairy_eggs': ['milk', 'cheese', 'yogurt', 'butter', 'eggs', 'cream', 'dairy_alt', 'refrigerated_dough'],
  'food.bakery': ['bread', 'buns_rolls', 'tortillas_flatbread', 'sweet_bakery', 'bagels'],
  'food.deli': ['deli_meat', 'deli_cheese', 'prepared_deli'],
  'food.frozen': ['frozen_vegetables', 'frozen_fruit', 'frozen_meals', 'frozen_breakfast', 'frozen_pizza', 'frozen_dessert', 'frozen_potato', 'frozen_protein'],
  'food.pantry': ['pasta', 'rice_grains', 'canned', 'legumes', 'soup', 'sauce', 'broth_stock', 'boxed_meals'],
  'food.breakfast': ['cereal', 'oatmeal', 'breakfast_bars', 'syrup_breakfast'],
  'food.snacks': ['chips', 'crackers', 'cookies', 'nuts_seeds', 'popcorn', 'dried_fruit_snacks', 'bars'],
  'food.candy': ['chocolate', 'gummy', 'hard_candy'],
  'food.condiments_sauces': ['condiment', 'dressing', 'salsa_dip', 'asian_sauce'],
  'food.baking': ['flour', 'sugar', 'leavening', 'baking_add_ins', 'baking_mix', 'extracts'],
  'food.herbs_spices_seasonings': ['spice', 'seasoning', 'salt', 'pepper'],
  'food.oils_cooking_fats': ['oil', 'vinegar', 'cooking_fat'],
  'food.nut_butters_jams_spreads': ['nut_butter', 'jam', 'honey_syrup'],
  'food.beverages': ['water', 'juice', 'soft_drink', 'sports_energy', 'drink_mix'],
  'food.coffee_tea': ['coffee', 'tea'],
  'baby.diapering': ['diapers', 'wipes', 'diaper_care'],
  'baby.feeding': ['formula', 'bottles_feeding'],
  'baby.baby_food': ['puree', 'snacks'],
  'baby.bath_care': ['bath', 'skin_care'],
  'household.paper': ['toilet_paper', 'paper_towel', 'tissue', 'napkins'],
  'household.cleaning': ['surface', 'bathroom', 'floor', 'wipes'],
  'household.laundry': ['detergent', 'softener', 'stain'],
  'household.storage_bags': ['food_bags', 'trash_bags', 'wraps'],
  'personal_care.hair': ['shampoo', 'conditioner', 'styling'],
  'personal_care.oral': ['toothpaste', 'toothbrush', 'floss', 'mouthwash'],
  'personal_care.bath_body': ['body_wash', 'soap', 'lotion'],
  'personal_care.feminine_care': ['pads_tampons'],
  'health_wellness.otc_medicine': ['pain_relief', 'cold_flu', 'allergy', 'digestive'],
  'health_wellness.vitamins_supplements': ['vitamins'],
  'health_wellness.first_aid': ['bandages', 'first_aid_care'],
  'pet.dog': ['dog_food', 'dog_care'],
  'pet.cat': ['cat_food', 'cat_care'],
} as const
