interface ValidationResult {
  schemaOrgValid: boolean;
  richResultsEligible: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSchema(jsonld: Record<string, any>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic JSON-LD validation
  if (!jsonld["@context"]) {
    errors.push("Missing @context");
  }

  if (!jsonld["@graph"] || !Array.isArray(jsonld["@graph"])) {
    errors.push("Missing or invalid @graph");
  }

  // Validate each entity in the graph
  if (jsonld["@graph"]) {
    for (const entity of jsonld["@graph"]) {
      validateEntity(entity, errors, warnings);
    }
  }

  // Rich results eligibility checks
  const richResultsEligible = checkRichResultsEligibility(jsonld, errors, warnings);

  return {
    schemaOrgValid: errors.length === 0,
    richResultsEligible,
    errors,
    warnings
  };
}

function validateEntity(entity: Record<string, any>, errors: string[], warnings: string[]): void {
  if (!entity["@type"]) {
    errors.push("Entity missing @type");
    return;
  }

  const type = entity["@type"];

  // Type-specific validation
  switch (type) {
    case "Product":
      validateProduct(entity, errors, warnings);
      break;
    case "Article":
    case "BlogPosting":
      validateArticle(entity, errors, warnings);
      break;
    case "LocalBusiness":
      validateLocalBusiness(entity, errors, warnings);
      break;
    case "Event":
      validateEvent(entity, errors, warnings);
      break;
    case "Recipe":
      validateRecipe(entity, errors, warnings);
      break;
    case "Organization":
      validateOrganization(entity, errors, warnings);
      break;
    case "WebSite":
      validateWebSite(entity, errors, warnings);
      break;
  }

  // Common validations
  if (entity.url && !isValidUrl(entity.url)) {
    errors.push(`Invalid URL: ${entity.url}`);
  }

  if (entity.image && !isValidUrl(entity.image)) {
    errors.push(`Invalid image URL: ${entity.image}`);
  }
}

function validateProduct(entity: Record<string, any>, errors: string[], warnings: string[]): void {
  if (!entity.name) {
    errors.push("Product missing required name");
  }

  if (entity.offers) {
    if (!entity.offers.price) {
      errors.push("Product offer missing price");
    }
    if (!entity.offers.priceCurrency) {
      errors.push("Product offer missing priceCurrency");
    }
  }

  if (!entity.image) {
    warnings.push("Product missing image - recommended for rich results");
  }

  if (entity.aggregateRating && !entity.aggregateRating.ratingCount) {
    warnings.push("AggregateRating missing ratingCount");
  }
}

function validateArticle(entity: Record<string, any>, errors: string[], warnings: string[]): void {
  if (!entity.name && !entity.headline) {
    errors.push("Article missing required name or headline");
  }

  if (!entity.author) {
    warnings.push("Article missing author - recommended for rich results");
  }

  if (!entity.datePublished) {
    warnings.push("Article missing datePublished - recommended for rich results");
  }

  if (!entity.image) {
    warnings.push("Article missing image - recommended for rich results");
  }

  if (!entity.publisher) {
    warnings.push("Article missing publisher - recommended for rich results");
  }
}

function validateLocalBusiness(entity: Record<string, any>, errors: string[], warnings: string[]): void {
  if (!entity.name) {
    errors.push("LocalBusiness missing required name");
  }

  if (!entity.address) {
    errors.push("LocalBusiness missing required address");
  }

  if (!entity.telephone) {
    warnings.push("LocalBusiness missing telephone - recommended for rich results");
  }

  if (!entity.openingHours) {
    warnings.push("LocalBusiness missing openingHours - recommended for rich results");
  }
}

function validateEvent(entity: Record<string, any>, errors: string[], warnings: string[]): void {
  if (!entity.name) {
    errors.push("Event missing required name");
  }

  if (!entity.startDate) {
    errors.push("Event missing required startDate");
  }

  if (!entity.location) {
    errors.push("Event missing required location");
  }
}

function validateRecipe(entity: Record<string, any>, errors: string[], warnings: string[]): void {
  if (!entity.name) {
    errors.push("Recipe missing required name");
  }

  if (!entity.recipeIngredient || !Array.isArray(entity.recipeIngredient)) {
    errors.push("Recipe missing required recipeIngredient array");
  }

  if (!entity.recipeInstructions || !Array.isArray(entity.recipeInstructions)) {
    errors.push("Recipe missing required recipeInstructions array");
  }

  if (!entity.image) {
    warnings.push("Recipe missing image - recommended for rich results");
  }
}

function validateOrganization(entity: Record<string, any>, errors: string[], warnings: string[]): void {
  if (!entity.name) {
    errors.push("Organization missing required name");
  }

  if (!entity.url) {
    warnings.push("Organization missing URL - recommended");
  }
}

function validateWebSite(entity: Record<string, any>, errors: string[], warnings: string[]): void {
  if (!entity.url) {
    errors.push("WebSite missing required url");
  }

  if (!entity.name) {
    warnings.push("WebSite missing name - recommended");
  }
}

function checkRichResultsEligibility(jsonld: Record<string, any>, errors: string[], warnings: string[]): boolean {
  if (errors.length > 0) {
    return false;
  }

  const graph = jsonld["@graph"] || [];
  const primaryEntity = graph.find((entity: any) => 
    entity["@type"] && !["Organization", "WebSite", "BreadcrumbList"].includes(entity["@type"])
  );

  if (!primaryEntity) {
    return false;
  }

  // Type-specific rich results eligibility
  switch (primaryEntity["@type"]) {
    case "Product":
      return primaryEntity.name && primaryEntity.image && primaryEntity.offers;
    case "Article":
    case "BlogPosting":
      return primaryEntity.name && primaryEntity.image && primaryEntity.author && primaryEntity.datePublished;
    case "LocalBusiness":
      return primaryEntity.name && primaryEntity.address;
    case "Event":
      return primaryEntity.name && primaryEntity.startDate && primaryEntity.location;
    case "Recipe":
      return primaryEntity.name && primaryEntity.image && primaryEntity.recipeIngredient && primaryEntity.recipeInstructions;
    default:
      return true;
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
