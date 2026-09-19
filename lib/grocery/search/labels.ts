// Human-friendly labels for shopping categories (UI display only).
export const SHOPPING_CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  bakery: 'Bakery',
  meat_seafood: 'Meat & Seafood',
  deli: 'Deli',
  dairy_eggs: 'Dairy & Eggs',
  pantry: 'Pantry',
  breakfast: 'Breakfast',
  snacks: 'Snacks',
  frozen: 'Frozen',
  beverages: 'Beverages',
  baby: 'Baby',
  household: 'Household',
  personal_care: 'Personal Care',
  health: 'Health',
  pet: 'Pet',
  other: 'Other',
}

export function shoppingCategoryLabel(id: string): string {
  return SHOPPING_CATEGORY_LABELS[id] ?? id
}
