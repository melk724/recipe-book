// Core math for scaling recipes and aggregating shopping lists

export interface Ingredient {
  id?: string;
  name: string;
  amount: number | null;
  unit: string | null;
  notes?: string;
  category?: string;
}

export interface Recipe {
  id?: string;
  title: string;
  description?: string;
  base_servings: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  cuisine?: string;
  tags?: string[];
  ingredients: Ingredient[];
  steps: { instruction: string; timer_seconds: number | null }[];
}

// Scale ingredients to a target serving size
export function scaleRecipe(recipe: Recipe, targetServings: number): Recipe {
  const multiplier = targetServings / recipe.base_servings;
  return {
    ...recipe,
    base_servings: targetServings,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      amount: ing.amount !== null ? roundSensibly(ing.amount * multiplier) : null,
    })),
  };
}

// Round to friendly fractions for cooking
function roundSensibly(n: number): number {
  if (n < 0.125) return Math.round(n * 100) / 100;
  if (n < 1) {
    // Snap to common fractions: 1/8, 1/4, 1/3, 1/2, 2/3, 3/4
    const fractions = [0.125, 0.25, 0.333, 0.5, 0.667, 0.75];
    const closest = fractions.reduce((prev, curr) =>
      Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev
    );
    return closest;
  }
  if (n < 10) return Math.round(n * 4) / 4; // nearest quarter
  return Math.round(n);
}

// Format amount as a readable fraction string
export function formatAmount(amount: number | null): string {
  if (amount === null) return '';
  if (amount === 0.125) return '⅛';
  if (amount === 0.25) return '¼';
  if (amount === 0.333) return '⅓';
  if (amount === 0.5) return '½';
  if (amount === 0.667) return '⅔';
  if (amount === 0.75) return '¾';
  if (amount < 1) return amount.toString();

  const whole = Math.floor(amount);
  const frac = amount - whole;
  if (frac === 0) return whole.toString();
  if (frac === 0.25) return `${whole}¼`;
  if (frac === 0.5) return `${whole}½`;
  if (frac === 0.75) return `${whole}¾`;
  return amount.toString();
}

// Combine ingredients across multiple scaled recipes into a shopping list
export interface ShoppingItem {
  name: string;
  amount: number | null;
  unit: string | null;
  category: string;
  fromRecipes: string[];
}

export function buildShoppingList(
  scaledRecipes: { recipe: Recipe; servings: number }[]
): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();

  for (const { recipe, servings } of scaledRecipes) {
    const scaled = scaleRecipe(recipe, servings);
    for (const ing of scaled.ingredients) {
      const key = `${ing.name.toLowerCase()}|${ing.unit || ''}`;
      const existing = map.get(key);
      if (existing) {
        existing.amount =
          existing.amount !== null && ing.amount !== null
            ? existing.amount + ing.amount
            : existing.amount || ing.amount;
        if (!existing.fromRecipes.includes(recipe.title)) {
          existing.fromRecipes.push(recipe.title);
        }
      } else {
        map.set(key, {
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          category: ing.category || 'other',
          fromRecipes: [recipe.title],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

/**
 * Round an ingredient amount UP to a friendly shopping-list quantity.
 * The idea: when buying ingredients, overshooting is fine — you just
 * end up with a little extra in the pantry. So always round up, but to
 * sensible increments based on the unit.
 *
 * Examples:
 *  - 1.5 onions (no unit) -> 2
 *  - 0.25 onion           -> 1
 *  - 1.3 tbsp             -> 2 tbsp
 *  - 1.6 cup              -> 2 cup
 *  - 0.4 cup              -> 0.5 cup
 *  - 1.7 lb               -> 2 lb
 *  - 130 g                -> 150 g
 *  - 0.6 l                -> 1 l
 */
export function roundUpForShopping(amount: number | null, unit: string | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  if (amount <= 0) return amount;

  const u = (unit || '').trim().toLowerCase();

  // No unit = countable whole items (onions, eggs, garlic cloves) → round up to whole
  if (!u) {
    return Math.ceil(amount);
  }

  // Round up to the nearest "step" based on unit
  const step = friendlyStep(u);
  return Math.ceil(amount / step) * step;
}

function friendlyStep(unit: string): number {
  switch (unit) {
    // Small volumes - round up to whole
    case 'tsp':
    case 'teaspoon':
    case 'teaspoons':
    case 'tbsp':
    case 'tablespoon':
    case 'tablespoons':
    case 'pinch':
      return 1;

    // Cups - round to nearest half
    case 'cup':
    case 'cups':
      return 0.5;

    // Ounces / fluid ounces - whole
    case 'oz':
    case 'ounce':
    case 'ounces':
    case 'fl oz':
    case 'fl_oz':
    case 'fluid ounce':
    case 'fluid ounces':
      return 1;

    // Pounds / kilograms - half-pound increments
    case 'lb':
    case 'lbs':
    case 'pound':
    case 'pounds':
    case 'kg':
    case 'kilogram':
    case 'kilograms':
      return 0.5;

    // Grams - 50g increments
    case 'g':
    case 'gram':
    case 'grams':
      return 50;

    // Milliliters - 100ml increments
    case 'ml':
    case 'milliliter':
    case 'milliliters':
      return 100;

    // Liters - half-liter increments
    case 'l':
    case 'liter':
    case 'liters':
    case 'litre':
    case 'litres':
      return 0.5;

    // Unknown unit - leave it as-is
    default:
      return 0.01; // minimal step = no real rounding (just 2-decimal precision)
  }
}
