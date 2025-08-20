import type { NormalizedContent } from "./fetcher";

interface Classification {
  primaryType: string;
  subtype?: string;
  confidence: number;
  features: string[];
  signals: string[];
}

export function classifyPage(content: NormalizedContent, hintDirective: any): Classification {
  const signals: string[] = [];
  let primaryType = "WebPage";
  let subtype: string | undefined;
  let confidence = 0.5;
  const features: string[] = [];

  // Check for existing structured data first
  if (content.existingJsonLd.length > 0) {
    const existingType = content.existingJsonLd[0]["@type"];
    if (existingType && typeof existingType === "string") {
      signals.push(`Existing JSON-LD: ${existingType}`);
      confidence = Math.max(confidence, 0.8);
    }
  }

  // Apply hint preference if provided
  if (hintDirective.preferredType) {
    primaryType = hintDirective.preferredType;
    confidence = Math.max(confidence, 0.7);
    signals.push(`Hint: ${hintDirective.preferredType}`);
  } else {
    // Rules-based classification cascade
    if (isProduct(content)) {
      primaryType = "Product";
      confidence = 0.9;
      signals.push("Price + currency detected");
      if (content.domSignals.hasAddToCart) signals.push("Add to cart button found");
      if (content.domSignals.hasSku) signals.push("SKU/product ID found");
    } else if (isLocalBusiness(content)) {
      primaryType = "LocalBusiness";
      confidence = 0.85;
      signals.push("NAP (Name, Address, Phone) detected");
      if (content.domSignals.hasHours) signals.push("Business hours found");
      if (content.domSignals.hasMap) signals.push("Map/location found");
      
      // Detect subtype
      subtype = detectLocalBusinessSubtype(content);
    } else if (isEvent(content)) {
      primaryType = "Event";
      confidence = 0.8;
      signals.push("Event date/time detected");
    } else if (isRecipe(content)) {
      primaryType = "Recipe";
      confidence = 0.85;
      signals.push("Ingredients and cooking steps found");
    } else if (isHowTo(content)) {
      primaryType = "HowTo";
      confidence = 0.8;
      signals.push("Step-by-step instructions detected");
    } else if (isArticle(content)) {
      if (isBlogPost(content)) {
        primaryType = "BlogPosting";
        confidence = 0.8;
        signals.push("Blog post structure detected");
      } else {
        primaryType = "Article";
        confidence = 0.75;
        signals.push("Article structure with byline/date");
      }
      
      // Detect article subtypes
      if (isNewsArticle(content)) {
        subtype = "NewsArticle";
        signals.push("News article indicators found");
      } else if (isTechArticle(content)) {
        subtype = "TechArticle";
        signals.push("Technical documentation detected");
      } else if (isReviewArticle(content)) {
        subtype = "Review";
        signals.push("Review with rating detected");
      }
    } else if (isItemList(content)) {
      primaryType = "ItemList";
      confidence = 0.8;
      signals.push("Numbered list with internal links");
    }
  }

  // Detect features
  if (content.domSignals.hasPrice && content.domSignals.hasCurrency) {
    features.push("offers");
  }
  if (content.domSignals.hasRating) {
    features.push("aggregateRating");
  }
  if (content.domSignals.hasReviews) {
    features.push("reviews");
  }
  if (content.domSignals.hasBreadcrumbs) {
    features.push("breadcrumbs");
  }
  if (content.domSignals.hasFAQ) {
    features.push("faq");
  }
  if (content.domSignals.hasVideo) {
    features.push("video");
  }

  return {
    primaryType,
    subtype,
    confidence,
    features,
    signals
  };
}

function isProduct(content: NormalizedContent): boolean {
  return content.domSignals.hasPrice && 
         content.domSignals.hasCurrency && 
         (content.domSignals.hasAddToCart || content.domSignals.hasSku);
}

function isLocalBusiness(content: NormalizedContent): boolean {
  return content.domSignals.hasNAP && 
         (content.domSignals.hasHours || content.domSignals.hasMap);
}

function isEvent(content: NormalizedContent): boolean {
  return content.domSignals.hasEvent && 
         /ticket|register|venue|location/.test(content.content.toLowerCase());
}

function isRecipe(content: NormalizedContent): boolean {
  return content.domSignals.hasRecipe && 
         /ingredients|cooking time|prep time|servings/.test(content.content.toLowerCase());
}

function isHowTo(content: NormalizedContent): boolean {
  return content.domSignals.hasSteps && 
         /how to|tutorial|guide|instructions/.test(content.content.toLowerCase());
}

function isArticle(content: NormalizedContent): boolean {
  return content.domSignals.hasByline && content.domSignals.hasPublishDate;
}

function isBlogPost(content: NormalizedContent): boolean {
  return /blog|post|article/.test(content.url.toLowerCase()) ||
         /blog|post/.test(content.content.toLowerCase());
}

function isItemList(content: NormalizedContent): boolean {
  return content.domSignals.hasItemList && 
         /top \d+|best \d+|list of|\d+ best/.test(content.content.toLowerCase());
}

function isNewsArticle(content: NormalizedContent): boolean {
  return /news|breaking|reuters|ap news|cnn|bbc/.test(content.content.toLowerCase()) ||
         /news/.test(content.url.toLowerCase());
}

function isTechArticle(content: NormalizedContent): boolean {
  return /documentation|api|technical|developer|programming|code/.test(content.content.toLowerCase());
}

function isReviewArticle(content: NormalizedContent): boolean {
  return /review of|rating|stars|pros and cons/.test(content.content.toLowerCase()) &&
         content.domSignals.hasRating;
}

function detectLocalBusinessSubtype(content: NormalizedContent): string | undefined {
  const text = content.content.toLowerCase();
  
  if (/restaurant|cafe|diner|bistro|eatery/.test(text)) return "Restaurant";
  if (/dentist|dental|orthodontist/.test(text)) return "Dentist";
  if (/doctor|physician|medical|clinic/.test(text)) return "MedicalOrganization";
  if (/hotel|motel|inn|lodge/.test(text)) return "LodgingBusiness";
  if (/store|shop|retail|boutique/.test(text)) return "Store";
  if (/gym|fitness|workout/.test(text)) return "ExerciseGym";
  if (/salon|spa|beauty/.test(text)) return "BeautySalon";
  
  return undefined;
}
