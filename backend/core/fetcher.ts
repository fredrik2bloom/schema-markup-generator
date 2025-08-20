import { secret } from "encore.dev/config";

const firecrawlApiKey = secret("FirecrawlApiKey");

interface FetchOptions {
  renderMode: "auto" | "html" | "headless";
}

interface NormalizedContent {
  url: string;
  canonicalUrl?: string;
  title: string;
  description?: string;
  content: string;
  html: string;
  meta: {
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    language?: string;
  };
  existingJsonLd: Record<string, any>[];
  existingMicrodata: Record<string, any>[];
  domSignals: {
    hasPrice: boolean;
    hasCurrency: boolean;
    hasAddToCart: boolean;
    hasSku: boolean;
    hasRating: boolean;
    hasReviews: boolean;
    hasNAP: boolean;
    hasHours: boolean;
    hasMap: boolean;
    hasEvent: boolean;
    hasRecipe: boolean;
    hasSteps: boolean;
    hasByline: boolean;
    hasPublishDate: boolean;
    hasBreadcrumbs: boolean;
    hasFAQ: boolean;
    hasVideo: boolean;
    hasItemList: boolean;
  };
  screenshot?: string;
}

export async function fetchAndNormalize(url: string, options: FetchOptions): Promise<NormalizedContent> {
  try {
    // Validate URL
    new URL(url);

    // Use Firecrawl to fetch content
    const response = await fetch("https://api.firecrawl.dev/v0/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firecrawlApiKey()}`,
      },
      body: JSON.stringify({
        url,
        pageOptions: {
          onlyMainContent: false,
          includeHtml: true,
          screenshot: options.renderMode === "headless",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`Firecrawl scraping failed: ${data.error || "Unknown error"}`);
    }

    const scrapedData = data.data;
    const html = scrapedData.html || "";
    const content = scrapedData.content || "";

    // Extract existing structured data
    const existingJsonLd = extractJsonLd(html);
    const existingMicrodata = extractMicrodata(html);

    // Extract meta information
    const meta = extractMeta(html);

    // Detect DOM signals
    const domSignals = detectDomSignals(html, content);

    // Extract canonical URL
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const canonicalUrl = canonicalMatch ? canonicalMatch[1] : undefined;

    return {
      url,
      canonicalUrl,
      title: scrapedData.metadata?.title || "",
      description: scrapedData.metadata?.description,
      content,
      html,
      meta,
      existingJsonLd,
      existingMicrodata,
      domSignals,
      screenshot: scrapedData.screenshot,
    };
  } catch (error) {
    throw new Error(`Failed to fetch and normalize content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function extractJsonLd(html: string): Record<string, any>[] {
  const schemas: Record<string, any>[] = [];
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const parsed = JSON.parse(jsonContent);
      
      if (Array.isArray(parsed)) {
        schemas.push(...parsed);
      } else {
        schemas.push(parsed);
      }
    } catch (parseError) {
      // Skip invalid JSON
      continue;
    }
  }

  return schemas;
}

function extractMicrodata(html: string): Record<string, any>[] {
  // Basic microdata extraction - would need more sophisticated parsing in production
  const microdata: Record<string, any>[] = [];
  
  // Look for itemscope elements
  const itemscopeRegex = /<[^>]+itemscope[^>]*>/gi;
  const matches = html.match(itemscopeRegex);
  
  if (matches) {
    // This is a simplified extraction - real implementation would parse the full microdata tree
    microdata.push({ type: "microdata", count: matches.length });
  }

  return microdata;
}

function extractMeta(html: string): NormalizedContent["meta"] {
  const meta: NormalizedContent["meta"] = {};

  // Open Graph
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitleMatch) meta.ogTitle = ogTitleMatch[1];

  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (ogDescMatch) meta.ogDescription = ogDescMatch[1];

  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImageMatch) meta.ogImage = ogImageMatch[1];

  // Twitter
  const twitterTitleMatch = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
  if (twitterTitleMatch) meta.twitterTitle = twitterTitleMatch[1];

  const twitterDescMatch = html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i);
  if (twitterDescMatch) meta.twitterDescription = twitterDescMatch[1];

  // Language
  const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  if (langMatch) meta.language = langMatch[1];

  return meta;
}

function detectDomSignals(html: string, content: string): NormalizedContent["domSignals"] {
  const lowerHtml = html.toLowerCase();
  const lowerContent = content.toLowerCase();

  return {
    hasPrice: /\$\d+|\€\d+|\£\d+|price|cost/.test(lowerContent) || /price|cost/.test(lowerHtml),
    hasCurrency: /\$|\€|\£|usd|eur|gbp|currency/.test(lowerContent),
    hasAddToCart: /add.to.cart|buy.now|purchase|checkout/.test(lowerContent),
    hasSku: /sku|product.id|item.number/.test(lowerContent),
    hasRating: /rating|stars|score|\d+\/\d+|\d+\.\d+.out.of/.test(lowerContent),
    hasReviews: /review|comment|feedback|testimonial/.test(lowerContent),
    hasNAP: /address|phone|contact/.test(lowerContent) && /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(content),
    hasHours: /hours|open|closed|monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(lowerContent),
    hasMap: /map|location|directions|latitude|longitude/.test(lowerContent) || /<iframe[^>]*maps/.test(lowerHtml),
    hasEvent: /event|date|time|venue|ticket|register/.test(lowerContent),
    hasRecipe: /ingredients|recipe|cooking|baking|preparation/.test(lowerContent),
    hasSteps: /step|instruction|how.to|tutorial/.test(lowerContent) && /\d+\./.test(content),
    hasByline: /author|by\s+\w+|written.by/.test(lowerContent),
    hasPublishDate: /published|posted|date|created/.test(lowerContent) && /\d{4}/.test(content),
    hasBreadcrumbs: /<nav[^>]*breadcrumb|<ol[^>]*breadcrumb|home\s*>\s*\w+\s*>\s*\w+/.test(lowerHtml),
    hasFAQ: /faq|frequently.asked|question|answer/.test(lowerContent),
    hasVideo: /<video|<iframe[^>]*youtube|<iframe[^>]*vimeo/.test(lowerHtml),
    hasItemList: /top\s+\d+|best\s+\d+|list.of|\d+\.\s+\w+/.test(lowerContent) && /h[2-6]/.test(lowerHtml),
  };
}
