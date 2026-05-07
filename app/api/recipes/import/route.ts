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
      // Fetch the URL and let Claude read the page
      content = [
        {
          type: 'text',
          text: `${EXTRACTION_PROMPT}\n\nExtract the recipe from this URL: ${url}\n\nIf you cannot fetch it, ask the user to paste the recipe text instead.`,
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
