import { Factory } from '@mikro-orm/seeder';
import { faker } from '@faker-js/faker';
import { Product } from '../../product/product.entity.js';
import { Category } from '../../category/category.entity.js';

export class ProductFactory extends Factory<Product> {
  model = Product;

  private productTemplates = {
    skincare: {
      names: [
        'hydrating facial cleanser',
        'anti-aging serum',
        'daily moisturizer',
        'vitamin c serum',
        'retinol night cream',
        'hyaluronic acid serum',
        'gentle exfoliating scrub',
        'eye cream',
        'sunscreen spf 50',
        'micellar water',
        'face mask',
        'toner',
        'essence',
        'spot treatment',
        'facial oil',
        'cleansing balm',
        'brightening serum',
        'peptide cream',
        'bha exfoliant',
        'niacinamide serum',
        'ceramide moisturizer',
        'collagen mask',
        'rose hip oil',
        'glycolic acid toner',
      ],
      priceRange: [15, 80],
      brands: [
        'glow',
        'pure',
        'radiance',
        'bloom',
        'essence',
        'luxe',
        'nature',
        'vital',
        'clear',
        'fresh',
      ],
    },
    makeup: {
      names: [
        'liquid foundation',
        'concealer',
        'setting powder',
        'blush',
        'bronzer',
        'highlighter',
        'eyeshadow palette',
        'mascara',
        'eyeliner',
        'lipstick',
        'lip gloss',
        'brow gel',
        'primer',
        'setting spray',
        'contour stick',
        'lip liner',
        'false eyelashes',
        'makeup remover',
        'bb cream',
        'tinted moisturizer',
        'cream blush',
        'liquid lipstick',
        'eyeshadow single',
        'brow pencil',
        'lip balm',
        'color corrector',
        'makeup sponge',
        'brush set',
      ],
      priceRange: [10, 60],
      brands: [
        'glamour',
        'beauty',
        'color',
        'velvet',
        'silk',
        'studio',
        'pro',
        'elite',
        'artistry',
        'divine',
      ],
    },
    'hair care': {
      names: [
        'moisturizing shampoo',
        'repairing conditioner',
        'hair mask',
        'leave-in treatment',
        'styling cream',
        'hair oil',
        'dry shampoo',
        'heat protectant',
        'hair serum',
        'volumizing mousse',
        'curl defining cream',
        'hair spray',
        'texturizing spray',
        'scalp treatment',
        'split end repair',
        'color protecting shampoo',
        'clarifying shampoo',
        'hair growth serum',
        'smoothing balm',
        'root lift spray',
        'hair gel',
        'pomade',
      ],
      priceRange: [12, 45],
      brands: [
        'mane',
        'locks',
        'strand',
        'crown',
        'silk',
        'smooth',
        'shine',
        'strong',
        'curl',
        'wave',
      ],
    },
    fragrance: {
      names: [
        'eau de parfum',
        'eau de toilette',
        'body spray',
        'perfume oil',
        'travel size perfume',
        'cologne',
        'solid perfume',
        'hair mist',
        'body mist',
        'scented lotion',
        'perfume gift set',
        'rollerball perfume',
        'fragrance sampler',
        'limited edition perfume',
        'unisex fragrance',
        'floral perfume',
        'woody cologne',
        'fresh scent',
        'oriental fragrance',
      ],
      priceRange: [25, 120],
      brands: [
        'mystique',
        'allure',
        'essence',
        'aura',
        'whisper',
        'bloom',
        'velvet',
        'dream',
        'luxury',
        'signature',
      ],
    },
    'body care': {
      names: [
        'body lotion',
        'body wash',
        'body scrub',
        'body butter',
        'hand cream',
        'foot cream',
        'body oil',
        'bath salts',
        'bubble bath',
        'shower gel',
        'exfoliating gloves',
        'body mist',
        'deodorant',
        'body serum',
        'lip scrub',
        'cuticle oil',
        'body powder',
        'massage oil',
        'after sun lotion',
        'self tanner',
        'body mask',
        'bath bomb',
      ],
      priceRange: [8, 35],
      brands: [
        'smooth',
        'soft',
        'silky',
        'pure',
        'natural',
        'tender',
        'gentle',
        'luxe',
        'comfort',
        'bliss',
      ],
    },
  };

  definition(): Partial<Product> {
    const category = faker.helpers.arrayElement([
      'skincare',
      'makeup',
      'hair care',
      'fragrance',
      'body care',
    ]);
    const template = this.productTemplates[category as keyof typeof this.productTemplates];

    const productName = faker.helpers.arrayElement(template.names);
    const brand = faker.helpers.arrayElement(template.brands);
    const price = faker.number.float({
      min: template.priceRange[0],
      max: template.priceRange[1],
      fractionDigits: 2,
    });

    const descriptions = {
      skincare: [
        'formulated with natural ingredients for healthy, glowing skin',
        'dermatologist-tested and suitable for sensitive skin',
        'anti-aging properties that help reduce fine lines and wrinkles',
        'deeply hydrating formula for smooth, supple skin',
        'clinically proven to improve skin texture and radiance',
      ],
      makeup: [
        'long-wearing formula that lasts all day',
        'highly pigmented for vibrant, true color',
        'blendable formula for seamless application',
        'buildable coverage from natural to full',
        'waterproof and smudge-proof formula',
      ],
      'hair care': [
        'nourishes and strengthens hair from root to tip',
        'sulfate-free formula safe for color-treated hair',
        'enriched with natural oils and vitamins',
        'helps repair damaged hair and prevent breakage',
        "lightweight formula that won't weigh hair down",
      ],
      fragrance: [
        'a captivating blend of floral and fruity notes',
        'long-lasting scent that evolves throughout the day',
        'perfect for both day and evening wear',
        'sophisticated fragrance with woody undertones',
        'fresh and energizing scent with citrus notes',
      ],
      'body care': [
        'moisturizes and nourishes skin for 24-hour hydration',
        'enriched with vitamins and natural extracts',
        'gentle formula suitable for daily use',
        'fast-absorbing and non-greasy texture',
        'leaves skin feeling soft, smooth, and refreshed',
      ],
    };

    const description = `${brand} ${productName} - ${faker.helpers.arrayElement(descriptions[category as keyof typeof descriptions])}`;

    return {
      name: `${brand} ${productName}`.toLowerCase(),
      description: description.toLowerCase(),
      price,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  withCategory(category: Category): this {
    return this.each((product) => {
      product.category = category;
      return product;
    });
  }
}
