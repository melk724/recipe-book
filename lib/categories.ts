// Centralized category and tag metadata

export const CATEGORIES = [
  { id: 'mains', label: 'Mains', emoji: '🍲', plural: 'Mains' },
  { id: 'soups', label: 'Soups', emoji: '🥣', plural: 'Soups' },
  { id: 'sides', label: 'Sides', emoji: '🥗', plural: 'Sides' },
  { id: 'salads', label: 'Salads', emoji: '🥬', plural: 'Salads' },
  { id: 'breads', label: 'Breads', emoji: '🥖', plural: 'Breads' },
  { id: 'breakfast', label: 'Breakfast', emoji: '🍳', plural: 'Breakfast' },
  { id: 'appetizers', label: 'Appetizers', emoji: '🥟', plural: 'Appetizers' },
  { id: 'snacks', label: 'Snacks', emoji: '🍿', plural: 'Snacks' },
  { id: 'desserts', label: 'Desserts', emoji: '🍪', plural: 'Desserts' },
  { id: 'drinks', label: 'Drinks', emoji: '🍹', plural: 'Drinks' },
  { id: 'sauces', label: 'Sauces', emoji: '🥫', plural: 'Sauces' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export function getCategoryMeta(id: string | null | undefined) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
}

// Category-specific color gradient for placeholder photos
export function categoryGradient(id: string | null | undefined): string {
  const map: Record<string, string> = {
    mains: 'linear-gradient(135deg, #C9764C 0%, #6B3825 100%)',
    soups: 'linear-gradient(135deg, #C9764C 0%, #6B3825 100%)',
    sides: 'linear-gradient(135deg, #B8A06A 0%, #6B5028 100%)',
    salads: 'linear-gradient(135deg, #9DBE6E 0%, #4A6029 100%)',
    breads: 'linear-gradient(135deg, #E8C896 0%, #A37532 100%)',
    breakfast: 'linear-gradient(135deg, #E8B879 0%, #C97A3A 100%)',
    appetizers: 'linear-gradient(135deg, #D4A04C 0%, #8B6529 100%)',
    snacks: 'linear-gradient(135deg, #B8A06A 0%, #6B5028 100%)',
    desserts: 'linear-gradient(135deg, #D4889C 0%, #8B4054 100%)',
    drinks: 'linear-gradient(135deg, #C97A5A 0%, #8B4F2C 100%)',
    sauces: 'linear-gradient(135deg, #B85838 0%, #5A2818 100%)',
  };
  return map[id || 'mains'] || map.mains;
}

export const TAG_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'gluten-free': 'Gluten-free',
  'dairy-free': 'Dairy-free',
  'nut-free': 'Nut-free',
  'low-carb': 'Low-carb',
  keto: 'Keto',
  healthy: 'Healthy',
  quick: 'Quick',
  'make-ahead': 'Make-ahead',
  'freezer-friendly': 'Freezer-friendly',
  'one-pan': 'One-pan',
  'no-cook': 'No-cook',
  weeknight: 'Weeknight',
  'comfort-food': 'Comfort food',
  'crowd-pleaser': 'Crowd-pleaser',
  'kid-friendly': 'Kid-friendly',
  holiday: 'Holiday',
  romantic: 'Romantic',
  spicy: 'Spicy',
  sweet: 'Sweet',
  savory: 'Savory',
  grilled: 'Grilled',
  baked: 'Baked',
  'slow-cooker': 'Slow-cooker',
  'instant-pot': 'Instant Pot',
};
