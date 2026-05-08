import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_PROMPT = `You are a recipe extraction expert. Extract the recipe from this image/document and return ONLY valid JSON matching this schema:

{
  "title": "Recipe name",
  "description": "Brief description if available",
  "base_servings": 4,
  "prep_time_minutes": 15,
  "cook_time_minutes": 30,
  "category": "mains",
  "cuisine": "Italian/Mexican/etc or null",
  "tags": ["vegetarian", "weeknight", "one-pan"],
  "ingredients": [
    {
      "name": "all-purpose flour",
      "amount": 2,
      "unit": "cup",
      "notes": "sifted",
      "category": "pantry"
    }
  ],
  "steps": [
    {
      "instruction": "Preheat oven to 350F",
      "timer_seconds": null
    },
    {
      "instruction": "Bake for 25 minutes",
      "timer_seconds": 1500
    }
  ]
}

CATEGORY (pick exactly ONE — must match exactly):
- "mains" — entrees, main courses, hearty pasta, casseroles
- "soups" — soups, stews, chili, broths
- "sides" — side dishes, vegetables, grains served alongside
- "salads" — salads as a side or light meal
- "breads" — yeasted breads, quick breads, biscuits, rolls
- "breakfast" — pancakes, eggs, oatmeal, brunch dishes
- "appetizers" — starters, dips, finger foods, hors d'oeuvres
- "snacks" — granola bars, trail mix, popcorn, anytime snacks
- "desserts" — cookies, cakes, pies, ice cream, sweet treats
- "drinks" — cocktails, mocktails, smoothies, infused waters, hot drinks
- "sauces" — sauces, dressings, marinades, condiments

TAGS (pick 2-5 that genuinely apply — pick from this list ONLY):
vegetarian, vegan, gluten-free, dairy-free, nut-free, low-carb, keto, healthy,
quick (under 30 min total), make-ahead, freezer-friendly, one-pan, no-cook,
weeknight, comfort-food, crowd-pleaser, kid-friendly, holiday, romantic,
spicy, sweet, savory, grilled, baked, slow-cooker, instant-pot

Ingredient categories: produce, dairy, meat, seafood, pantry, spices, bakery, frozen, beverages, other.
Units should be standard: tsp, tbsp, cup, oz, lb, g, kg, ml, l, or null for whole items.
For whole items (e.g. "2 eggs"), put the noun in name ("eggs") and leave unit null.
For timer_seconds, only include if the step has a specific wait time (bake 25 min = 1500). Active steps = null.
Return ONLY the JSON, no markdown, no commentary.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceType, data, url } = body;

    let content: any[] = [];

    if (sourceType === 'url') {
      // Some recipe sites use stripped-down print views that don't include JSON-LD.
      // The most common is WP Recipe Maker's /wprm_print/{slug} -> redirect to /{slug}/ on the same domain.
      // We try the canonical URL first; if that fails, we still attempt the original.
      const urlsToTry: string[] = [];
      try {
        const u = new URL(url);
        const wprmMatch = u.pathname.match(/^\/wprm_print\/(.+?)\/?$/);
        if (wprmMatch) {
          // Try the canonical post URL first - it will have full JSON-LD
          urlsToTry.push(`${u.origin}/${wprmMatch[1]}/`);
        }
        urlsToTry.push(url);
      } catch {
        urlsToTry.push(url);
      }

      // Step 1: fetch the page server-side
      let html = '';
      let lastError = '';
      for (const tryUrl of urlsToTry) {
        try {
          const fetchRes = await fetch(tryUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
          });
          if (!fetchRes.ok) {
            lastError = `Page returned ${fetchRes.status}`;
            continue;
          }
          html = await fetchRes.text();
          // Quick sanity check - if it's tiny, the site probably blocked us
          if (html.length < 500) {
            lastError = 'Page returned almost empty content (may be blocking automated requests)';
            continue;
          }
          break;
        } catch (e: any) {
          lastError = e.message;
        }
      }
      if (!html) {
        return NextResponse.json({
          error: `Couldn't reach that URL — ${lastError}. Try copying the recipe text and pasting it instead.`,
        }, { status: 400 });
      }

      // Step 2: try to extract a structured Recipe from JSON-LD
      // Almost every real recipe site embeds schema.org Recipe data for Google.
      // This is the ground truth — far more reliable than parsing prose.
      const jsonLdRecipe = extractJsonLdRecipe(html);
      if (jsonLdRecipe) {
        return NextResponse.json({ recipe: jsonLdRecipe });
      }

      // Step 3: fallback — extract the article body and send to Claude with a tighter prompt
      const articleText = extractMainContent(html);
      content = [
        {
          type: 'text',
          text: `${EXTRACTION_PROMPT}

CRITICAL CONTEXT — you are extracting a recipe from a webpage. The text below was scraped from this URL: ${url}

Webpages often include MULTIPLE recipes (related posts, "you might also like" sections, sidebars). They also include long personal essays, comments, ads, and navigation text.

Extract ONLY the SINGLE main recipe that the page is primarily about — usually the one matching the page's main title or URL slug. Ignore:
- Related-recipe sidebars or "you might also like" widgets
- Reader comments, even if they include their own variations
- The author's personal story or essay before the recipe
- Navigation, ads, newsletter signup forms, footer content

If the recipe has MULTIPLE INGREDIENT SECTIONS (e.g., "Dough" and "Glaze", or "Filling" and "Topping", or "Cake" and "Frosting"), COMBINE all sections into ONE unified ingredients array. Use the "notes" field on each ingredient to indicate which section it belongs to (e.g., notes: "for the dough" or "for the herb seasoning"). Do NOT skip any sections.

Same applies to instructions — combine sub-sections into one numbered sequence in the order they appear.

If you find multiple recipes and can't tell which is the main one, prefer the one whose title best matches the page URL or appears first in a recipe-card-style block (with explicit "Ingredients" and "Instructions" headers).

Webpage content:
${articleText}`,
        },
      ];
    } else if (sourceType === 'image' || sourceType === 'camera') {
      // Support both single-image (legacy: data + mediaType) and multi-image (images: [{data, mediaType}])
      const images = body.images || (body.data ? [{ data: body.data, mediaType: body.mediaType || 'image/jpeg' }] : []);
      if (!images.length) {
        return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
      }
      const imageBlocks = images.map((img: { data: string; mediaType?: string }) => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType || 'image/jpeg',
          data: img.data,
        },
      }));
      const promptText = images.length > 1
        ? `${EXTRACTION_PROMPT}\n\nIMPORTANT: These ${images.length} images are pages of the SAME recipe (e.g., a cookbook spread). Combine all the text and ingredients from every page into ONE unified recipe. Don't return multiple recipes.`
        : EXTRACTION_PROMPT;
      content = [...imageBlocks, { type: 'text', text: promptText }];
    } else if (sourceType === 'pdf') {
      content = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: data,
          },
        },
        { type: 'text', text: EXTRACTION_PROMPT },
      ];
    } else if (sourceType === 'text') {
      content = [
        { type: 'text', text: `${EXTRACTION_PROMPT}\n\nRecipe text:\n${data}` },
      ];
    }

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content }],
    });

    const textBlock = response.content.find((b) => b.type === 'text') as any;
    const rawText = textBlock?.text || '';

    // Strip any markdown fences just in case
    const cleaned = rawText.replace(/```json\n?|```\n?/g, '').trim();
    const recipe = JSON.parse(cleaned);

    return NextResponse.json({ recipe });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract recipe' },
      { status: 500 }
    );
  }
}

// ============================================
// Helper: extract a Recipe from schema.org JSON-LD blocks
// Almost every real recipe site embeds these for Google rich results
// ============================================
function extractJsonLdRecipe(html: string): any | null {
  try {
    // Find all <script type="application/ld+json">...</script> blocks
    const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const matches = Array.from(html.matchAll(re));

    for (const match of matches) {
      const jsonText = match[1].trim();
      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        // Some sites have malformed JSON-LD with trailing commas or HTML entities; skip
        continue;
      }

      // The Recipe might be the root, in an array, or nested in a @graph
      const candidates = collectJsonLdNodes(parsed);
      const recipeNode = candidates.find((n) => isRecipeType(n));
      if (recipeNode) {
        return mapJsonLdToRecipe(recipeNode);
      }
    }
    return null;
  } catch (e) {
    console.warn('JSON-LD extraction failed:', e);
    return null;
  }
}

// JSON-LD blocks can be: a Recipe object, an array, or { @graph: [...] }
function collectJsonLdNodes(node: any): any[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(collectJsonLdNodes);
  if (typeof node !== 'object') return [];
  const out: any[] = [node];
  if (Array.isArray(node['@graph'])) {
    out.push(...node['@graph'].flatMap(collectJsonLdNodes));
  }
  return out;
}

function isRecipeType(node: any): boolean {
  const t = node?.['@type'];
  if (!t) return false;
  if (typeof t === 'string') return t === 'Recipe';
  if (Array.isArray(t)) return t.includes('Recipe');
  return false;
}

// Convert a schema.org Recipe to our internal recipe schema
function mapJsonLdToRecipe(r: any): any {
  const ingredients = (r.recipeIngredient || []).map((line: string) => parseIngredientLine(line));
  const steps = parseInstructions(r.recipeInstructions);
  const servings = parseServings(r.recipeYield);
  const prepMin = parseDurationMinutes(r.prepTime);
  const cookMin = parseDurationMinutes(r.cookTime);

  return {
    title: typeof r.name === 'string' ? r.name.trim() : 'Untitled recipe',
    description: typeof r.description === 'string' ? r.description.trim().slice(0, 500) : null,
    base_servings: servings || 4,
    prep_time_minutes: prepMin,
    cook_time_minutes: cookMin,
    category: guessCategory(r),
    cuisine: typeof r.recipeCuisine === 'string' ? r.recipeCuisine : null,
    tags: Array.isArray(r.keywords)
      ? r.keywords.slice(0, 8)
      : typeof r.keywords === 'string'
        ? r.keywords.split(/,\s*/).slice(0, 8)
        : [],
    ingredients,
    steps,
  };
}

// "1 1/2 cups all-purpose flour, sifted" -> { name, amount, unit, notes }
// We do a best-effort parse; Claude could re-parse if needed but keeping it simple.
function parseIngredientLine(line: string): any {
  if (typeof line !== 'string') return { name: String(line), amount: null, unit: null };
  // Strip common markdown bold/asterisk markers and footnote markers like **
  let original = line.trim().replace(/\s+/g, ' ').replace(/\*+/g, '');

  // Strip leading bullets
  let s = original.replace(/^[-•]\s*/, '');

  // Match a leading amount.
  // Order matters: try most-specific patterns first.
  let amount: number | null = null;
  // Try mixed integer + space + ascii fraction: "1 1/2"
  let m = s.match(/^(\d+\s+\d+\/\d+)\s*/);
  if (!m) {
    // Try integer + space + unicode fraction: "1 ½"
    m = s.match(/^(\d+\s+[¼½¾⅓⅔⅛⅜⅝⅞])\s*/);
  }
  if (!m) {
    // Try plain ascii fraction: "1/4"
    m = s.match(/^(\d+\/\d+)\s*/);
  }
  if (!m) {
    // Try integer-attached or standalone unicode fraction: "1½", "½"
    m = s.match(/^(\d*[¼½¾⅓⅔⅛⅜⅝⅞])\s*/);
  }
  if (!m) {
    // Try decimal or whole number, optionally a range: "1.5", "12", "1-2"
    m = s.match(/^(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*/);
  }
  if (m) {
    amount = parseAmount(m[1]);
    s = s.slice(m[0].length);
  }

  // Strip parenthetical alt-measurements like "(4 cups)" or "(approx. 100ml)"
  // These appear right after the primary amount and aren't part of the name
  s = s.replace(/^\([^)]*\)\s*/, '');

  // Match a unit
  const unitRegex = /^(cups?|c\.?|tablespoons?|tbsps?|tbs|tablespoon|teaspoons?|tsps?|teaspoon|ounces?|oz|pounds?|lbs?|lb|grams?|g|kilograms?|kg|milliliters?|ml|liters?|litres?|l|pinch|pinches|cloves?|sticks?|cans?|packages?|pkgs?|slices?|sprigs?|bunches?)\s+/i;
  const unitMatch = s.match(unitRegex);
  let unit: string | null = null;
  if (unitMatch) {
    unit = normalizeUnit(unitMatch[1]);
    s = s.slice(unitMatch[0].length);
  }

  // Sometimes another parenthetical follows the unit ("500g (4 cups) bread flour")
  s = s.replace(/^\([^)]*\)\s*/, '');

  // Split name and notes on first comma
  const commaIdx = s.indexOf(',');
  let name = s.trim();
  let notes: string | undefined;
  if (commaIdx > -1) {
    name = s.slice(0, commaIdx).trim();
    notes = s.slice(commaIdx + 1).trim() || undefined;
  }

  // If we couldn't extract a name at all, fall back to original line
  if (!name) {
    return { name: original, amount: null, unit: null };
  }

  return { name, amount, unit, notes };
}

function parseAmount(s: string): number | null {
  const fractions: Record<string, number> = {
    '¼': 0.25, '½': 0.5, '¾': 0.75,
    '⅓': 1 / 3, '⅔': 2 / 3,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  };
  // Replace unicode fractions with spaced decimals: "1½" -> "1 0.5", "½" -> " 0.5"
  let normalized = s;
  for (const [k, v] of Object.entries(fractions)) {
    normalized = normalized.replaceAll(k, ` ${v}`);
  }
  // Handle ranges like "1-2" by taking the lower bound
  if (normalized.includes('-')) normalized = normalized.split('-')[0];

  normalized = normalized.trim();

  // Handle "1 1/2" mixed numbers (ASCII fraction)
  const mixedMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
  }

  // Handle "1/2" plain fractions
  const fracMatch = normalized.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
  }

  // Handle "1 0.5" — integer plus space-separated decimal (came from "1 ½")
  const intDecMatch = normalized.match(/^(\d+)\s+(\d*\.\d+)$/);
  if (intDecMatch) {
    return parseInt(intDecMatch[1]) + parseFloat(intDecMatch[2]);
  }

  // Plain number, possibly with a leading or trailing space
  const n = parseFloat(normalized);
  return isNaN(n) ? null : Math.round(n * 1000) / 1000;
}

function normalizeUnit(u: string): string {
  const k = u.toLowerCase().replace(/\.$/, '');
  const map: Record<string, string> = {
    c: 'cup', cup: 'cup', cups: 'cup',
    tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
    tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
    oz: 'oz', ounce: 'oz', ounces: 'oz',
    lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
    g: 'g', gram: 'g', grams: 'g',
    kg: 'kg', kilogram: 'kg', kilograms: 'kg',
    ml: 'ml', milliliter: 'ml', milliliters: 'ml',
    l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  };
  return map[k] || k;
}

// JSON-LD instructions can be: string, array of strings, array of HowToStep, nested HowToSection
function parseInstructions(input: any): any[] {
  if (!input) return [];
  if (typeof input === 'string') {
    // One big text block — split on numbered patterns or double-newlines
    return splitInstructionText(input);
  }
  if (Array.isArray(input)) {
    const steps: any[] = [];
    for (const item of input) {
      if (typeof item === 'string') {
        steps.push({ position: steps.length + 1, instruction: cleanText(item), timer_seconds: null });
      } else if (item?.['@type'] === 'HowToStep') {
        const text = item.text || item.name || '';
        if (text.trim()) {
          steps.push({ position: steps.length + 1, instruction: cleanText(text), timer_seconds: null });
        }
      } else if (item?.['@type'] === 'HowToSection') {
        // Sections contain itemListElement
        const innerSteps = parseInstructions(item.itemListElement);
        for (const s of innerSteps) {
          steps.push({ ...s, position: steps.length + 1 });
        }
      } else if (item?.text) {
        steps.push({ position: steps.length + 1, instruction: cleanText(item.text), timer_seconds: null });
      }
    }
    return steps;
  }
  return [];
}

function splitInstructionText(text: string): any[] {
  const cleaned = cleanText(text);
  // Try splitting on "Step 1.", "1.", or double-newlines
  let parts = cleaned.split(/(?:^|\n+)(?:Step\s+)?\d+[\.\)]\s*/i).filter((p) => p.trim().length > 5);
  if (parts.length < 2) {
    parts = cleaned.split(/\n{2,}/).filter((p) => p.trim().length > 5);
  }
  if (parts.length < 2) {
    parts = [cleaned];
  }
  return parts.map((p, i) => ({
    position: i + 1,
    instruction: p.trim(),
    timer_seconds: null,
  }));
}

function parseServings(yieldValue: any): number | null {
  if (typeof yieldValue === 'number') return Math.round(yieldValue);
  if (typeof yieldValue === 'string') {
    // Find ALL numbers in the string
    const numbers = Array.from(yieldValue.matchAll(/(\d+)/g)).map((m) => parseInt(m[1]));
    if (numbers.length === 0) return null;
    // If text mentions slices, pieces, cookies, servings, etc., prefer the larger number
    // ("1 loaf (12 slices)" should yield 12, not 1)
    if (/slice|piece|cookie|muffin|serving|portion|biscuit|roll|bun|bar/i.test(yieldValue) && numbers.length > 1) {
      return Math.max(...numbers);
    }
    // Otherwise use the first number
    return numbers[0];
  }
  if (Array.isArray(yieldValue) && yieldValue.length) {
    // recipeYield can be ["12 servings", "12"] - use the first that parses
    for (const v of yieldValue) {
      const n = parseServings(v);
      if (n) return n;
    }
  }
  return null;
}

// "PT1H30M" -> 90 minutes
function parseDurationMinutes(iso: any): number | null {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const h = parseInt(m[1] || '0');
  const min = parseInt(m[2] || '0');
  const total = h * 60 + min;
  return total > 0 ? total : null;
}

// Best-effort category guess from JSON-LD fields
function guessCategory(r: any): string {
  const cat = (r.recipeCategory || '').toString().toLowerCase();
  const name = (r.name || '').toString().toLowerCase();
  const text = `${cat} ${name}`;

  if (/bread|loaf|bun|roll|bagel|focaccia|sourdough|brioche/.test(text)) return 'breads';
  if (/breakfast|pancake|waffle|granola|oatmeal|frittata/.test(text)) return 'breakfast';
  if (/dessert|cake|cookie|pie|tart|brownie|ice cream|pudding|truffle/.test(text)) return 'desserts';
  if (/soup|stew|chowder|broth|bisque/.test(text)) return 'soups';
  if (/salad/.test(text)) return 'salads';
  if (/appetizer|hors d'oeuvre|starter|dip/.test(text)) return 'appetizers';
  if (/snack/.test(text)) return 'snacks';
  if (/drink|beverage|cocktail|smoothie|juice|tea|coffee/.test(text)) return 'drinks';
  if (/sauce|dressing|marinade|condiment/.test(text)) return 'sauces';
  if (/side dish/.test(text) || /\bsides?\b/.test(cat)) return 'sides';
  return 'mains';
}

// ============================================
// Helper: cleaned-up main content text from arbitrary HTML
// (used as Claude fallback when JSON-LD isn't available)
// ============================================
function extractMainContent(html: string): string {
  let s = html;

  // Remove scripts, styles, noscript, iframes, svg
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  s = s.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  s = s.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

  // Drop common chrome regions: nav, header, footer, aside, comments
  s = s.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
  s = s.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');
  s = s.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
  s = s.replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');
  s = s.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  // Try to isolate a <main> or <article> if present (the actual content wrapper)
  const mainMatch = s.match(/<main\b[\s\S]*?<\/main>/i);
  if (mainMatch) s = mainMatch[0];
  else {
    const articleMatch = s.match(/<article\b[\s\S]*?<\/article>/i);
    if (articleMatch) s = articleMatch[0];
  }

  // Strip remaining tags but preserve some structure
  s = s.replace(/<\/(p|div|li|h[1-6]|br)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&hellip;/g, '…');
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));

  // Collapse whitespace
  s = s.replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Cap length to keep token costs sane (roughly 30k chars ≈ 7-8k tokens)
  if (s.length > 30000) s = s.slice(0, 30000) + '\n\n[content truncated]';
  return s;
}

function cleanText(text: string): string {
  // Strip any HTML tags that snuck into instruction text and collapse whitespace
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
