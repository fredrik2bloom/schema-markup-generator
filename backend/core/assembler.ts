import type { PolicyResult } from "./policy";
import type { NormalizedContent } from "./fetcher";

export function assembleSchema(policyResult: PolicyResult, content: NormalizedContent): Record<string, any> {
  const graph: Record<string, any>[] = [];
  const baseUrl = new URL(content.canonicalUrl || content.url);
  const siteUrl = `${baseUrl.protocol}//${baseUrl.host}`;

  // Always include Organization
  const organization = {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    "name": extractOrganizationName(content),
    "url": siteUrl
  };
  graph.push(organization);

  // Always include WebSite
  const website = {
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    "url": siteUrl,
    "name": extractSiteName(content),
    "publisher": { "@id": `${siteUrl}/#organization` }
  };
  graph.push(website);

  // Add breadcrumbs if detected
  if (policyResult.features.includes("breadcrumbs")) {
    const breadcrumbs = assembleBreadcrumbs(content);
    if (breadcrumbs) {
      graph.push(breadcrumbs);
    }
  }

  // Assemble primary entity
  const primaryEntity = assemblePrimaryEntity(policyResult, content);
  graph.push(primaryEntity);

  // Add mentions if any
  if (policyResult.mentions.length > 0) {
    primaryEntity.mentions = policyResult.mentions.map(mention => ({
      "@type": mention,
      "name": content.title
    }));
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph
  };
}

function assemblePrimaryEntity(policyResult: PolicyResult, content: NormalizedContent): Record<string, any> {
  const baseUrl = new URL(content.canonicalUrl || content.url);
  const siteUrl = `${baseUrl.protocol}//${baseUrl.host}`;
  
  const entity: Record<string, any> = {
    "@type": policyResult.subtype || policyResult.primaryType,
    "@id": `${content.url}#${policyResult.primaryType.toLowerCase()}`,
    "name": content.title,
    "url": content.url
  };

  if (content.description) {
    entity.description = content.description;
  }

  // Add type-specific properties
  switch (policyResult.primaryType) {
    case "Product":
      assembleProductProperties(entity, policyResult, content);
      break;
    case "Article":
    case "BlogPosting":
      assembleArticleProperties(entity, policyResult, content, siteUrl);
      break;
    case "LocalBusiness":
      assembleLocalBusinessProperties(entity, policyResult, content);
      break;
    case "Event":
      assembleEventProperties(entity, policyResult, content);
      break;
    case "Recipe":
      assembleRecipeProperties(entity, policyResult, content);
      break;
    case "HowTo":
      assembleHowToProperties(entity, policyResult, content);
      break;
    case "ItemList":
      assembleItemListProperties(entity, policyResult, content);
      break;
    default:
      assembleWebPageProperties(entity, policyResult, content, siteUrl);
  }

  return entity;
}

function assembleProductProperties(entity: Record<string, any>, policyResult: PolicyResult, content: NormalizedContent): void {
  if (policyResult.features.includes("offers")) {
    entity.offers = {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": extractCurrency(content),
      "price": extractPrice(content)
    };
  }

  if (policyResult.features.includes("aggregateRating")) {
    entity.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": extractRating(content),
      "ratingCount": extractRatingCount(content)
    };
  }

  if (content.meta.ogImage) {
    entity.image = content.meta.ogImage;
  }
}

function assembleArticleProperties(entity: Record<string, any>, policyResult: PolicyResult, content: NormalizedContent, siteUrl: string): void {
  entity.isPartOf = { "@id": `${siteUrl}/#website` };
  
  if (content.domSignals.hasByline) {
    entity.author = {
      "@type": "Person",
      "name": extractAuthor(content)
    };
  }

  if (content.domSignals.hasPublishDate) {
    entity.datePublished = extractPublishDate(content);
  }

  if (content.meta.ogImage) {
    entity.image = content.meta.ogImage;
  }

  entity.publisher = { "@id": `${siteUrl}/#organization` };
}

function assembleLocalBusinessProperties(entity: Record<string, any>, policyResult: PolicyResult, content: NormalizedContent): void {
  const address = extractAddress(content);
  if (address) {
    entity.address = address;
  }

  const phone = extractPhone(content);
  if (phone) {
    entity.telephone = phone;
  }

  if (content.domSignals.hasHours) {
    entity.openingHours = extractOpeningHours(content);
  }
}

function assembleEventProperties(entity: Record<string, any>, policyResult: PolicyResult, content: NormalizedContent): void {
  entity.startDate = extractEventDate(content);
  entity.location = extractEventLocation(content);
}

function assembleRecipeProperties(entity: Record<string, any>, policyResult: PolicyResult, content: NormalizedContent): void {
  entity.recipeIngredient = extractIngredients(content);
  entity.recipeInstructions = extractRecipeInstructions(content);
  
  const cookTime = extractCookTime(content);
  if (cookTime) {
    entity.cookTime = cookTime;
  }
}

function assembleHowToProperties(entity: Record<string, any>, policyResult: PolicyResult, content: NormalizedContent): void {
  entity.step = extractHowToSteps(content);
}

function assembleItemListProperties(entity: Record<string, any>, policyResult: PolicyResult, content: NormalizedContent): void {
  entity.itemListElement = extractListItems(content);
  entity.numberOfItems = entity.itemListElement.length;
}

function assembleWebPageProperties(entity: Record<string, any>, policyResult: PolicyResult, content: NormalizedContent, siteUrl: string): void {
  entity.isPartOf = { "@id": `${siteUrl}/#website` };
  
  if (content.meta.ogImage) {
    entity.image = content.meta.ogImage;
  }
}

function assembleBreadcrumbs(content: NormalizedContent): Record<string, any> | null {
  // Simple breadcrumb extraction - would be more sophisticated in production
  const breadcrumbMatch = content.content.match(/Home\s*>\s*([^>]+)(?:\s*>\s*([^>]+))?/i);
  if (!breadcrumbMatch) return null;

  const items = ["Home"];
  if (breadcrumbMatch[1]) items.push(breadcrumbMatch[1].trim());
  if (breadcrumbMatch[2]) items.push(breadcrumbMatch[2].trim());

  return {
    "@type": "BreadcrumbList",
    "@id": `${content.url}#breadcrumbs`,
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item
    }))
  };
}

// Extraction helper functions
function extractOrganizationName(content: NormalizedContent): string {
  return new URL(content.url).hostname.replace(/^www\./, "");
}

function extractSiteName(content: NormalizedContent): string {
  return content.meta.ogTitle || content.title || extractOrganizationName(content);
}

function extractCurrency(content: NormalizedContent): string {
  if (content.content.includes("$")) return "USD";
  if (content.content.includes("€")) return "EUR";
  if (content.content.includes("£")) return "GBP";
  return "USD"; // Default
}

function extractPrice(content: NormalizedContent): string {
  const priceMatch = content.content.match(/[\$€£](\d+(?:\.\d{2})?)/);
  return priceMatch ? priceMatch[1] : "0";
}

function extractRating(content: NormalizedContent): string {
  const ratingMatch = content.content.match(/(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*(\d+)/);
  return ratingMatch ? ratingMatch[1] : "5";
}

function extractRatingCount(content: NormalizedContent): string {
  const countMatch = content.content.match(/(\d+)\s*reviews?/i);
  return countMatch ? countMatch[1] : "1";
}

function extractAuthor(content: NormalizedContent): string {
  const authorMatch = content.content.match(/(?:by|author|written by)\s+([A-Z][a-z]+ [A-Z][a-z]+)/i);
  return authorMatch ? authorMatch[1] : "Anonymous";
}

function extractPublishDate(content: NormalizedContent): string {
  const dateMatch = content.content.match(/(\d{4}-\d{2}-\d{2})/);
  return dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
}

function extractAddress(content: NormalizedContent): Record<string, any> | null {
  // Simplified address extraction
  const addressMatch = content.content.match(/(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd))/i);
  if (!addressMatch) return null;

  return {
    "@type": "PostalAddress",
    "streetAddress": addressMatch[1]
  };
}

function extractPhone(content: NormalizedContent): string | null {
  const phoneMatch = content.content.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
  return phoneMatch ? phoneMatch[1] : null;
}

function extractOpeningHours(content: NormalizedContent): string[] {
  // Simplified - would need more sophisticated parsing
  return ["Mo-Fr 09:00-17:00"];
}

function extractEventDate(content: NormalizedContent): string {
  const dateMatch = content.content.match(/(\d{4}-\d{2}-\d{2})/);
  return dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
}

function extractEventLocation(content: NormalizedContent): Record<string, any> {
  return {
    "@type": "Place",
    "name": "Event Location"
  };
}

function extractIngredients(content: NormalizedContent): string[] {
  // Simplified ingredient extraction
  const ingredients: string[] = [];
  const lines = content.content.split('\n');
  
  for (const line of lines) {
    if (/^\s*\d+/.test(line) && /cup|tablespoon|teaspoon|pound|ounce/.test(line)) {
      ingredients.push(line.trim());
    }
  }
  
  return ingredients.length > 0 ? ingredients : ["Ingredient 1", "Ingredient 2"];
}

function extractRecipeInstructions(content: NormalizedContent): Record<string, any>[] {
  const instructions: Record<string, any>[] = [];
  const lines = content.content.split('\n');
  
  let stepNumber = 1;
  for (const line of lines) {
    if (/^\s*\d+\./.test(line)) {
      instructions.push({
        "@type": "HowToStep",
        "text": line.replace(/^\s*\d+\.\s*/, "").trim()
      });
      stepNumber++;
    }
  }
  
  return instructions.length > 0 ? instructions : [
    { "@type": "HowToStep", "text": "Follow the recipe instructions" }
  ];
}

function extractCookTime(content: NormalizedContent): string | null {
  const timeMatch = content.content.match(/(\d+)\s*(?:minutes?|mins?|hours?|hrs?)/i);
  if (timeMatch) {
    const time = parseInt(timeMatch[1]);
    const unit = timeMatch[0].toLowerCase();
    if (unit.includes('hour') || unit.includes('hr')) {
      return `PT${time}H`;
    } else {
      return `PT${time}M`;
    }
  }
  return null;
}

function extractHowToSteps(content: NormalizedContent): Record<string, any>[] {
  const steps: Record<string, any>[] = [];
  const lines = content.content.split('\n');
  
  for (const line of lines) {
    if (/^\s*\d+\./.test(line) || /^step \d+/i.test(line)) {
      steps.push({
        "@type": "HowToStep",
        "text": line.replace(/^\s*(?:\d+\.|step \d+:?)\s*/i, "").trim()
      });
    }
  }
  
  return steps.length > 0 ? steps : [
    { "@type": "HowToStep", "text": "Follow the instructions" }
  ];
}

function extractListItems(content: NormalizedContent): Record<string, any>[] {
  const items: Record<string, any>[] = [];
  const lines = content.content.split('\n');
  
  let position = 1;
  for (const line of lines) {
    if (/^\s*\d+\./.test(line) && line.length > 10) {
      items.push({
        "@type": "ListItem",
        "position": position,
        "name": line.replace(/^\s*\d+\.\s*/, "").trim()
      });
      position++;
    }
  }
  
  return items.length > 0 ? items.slice(0, 10) : [
    { "@type": "ListItem", "position": 1, "name": "List item 1" }
  ];
}
