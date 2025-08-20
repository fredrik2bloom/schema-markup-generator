interface HintDirective {
  preferredType?: string;
  secondaryTypes?: string[];
  profile?: string;
  enrich?: string[];
  suppress?: string[];
  strictness?: string;
  language?: string;
  renderMode?: string;
  prioritySignals?: string[];
  maxItems?: number;
  forceIdRoot?: boolean;
}

const VALID_TYPES = [
  "Product", "BlogPosting", "Article", "ItemList", "LocalBusiness", 
  "Event", "Recipe", "Course", "HowTo", "SoftwareApplication", "WebPage"
];

const VALID_PROFILES = ["blog", "store", "local", "recipe", "events", "saas", "auto"];

const VALID_FEATURES = [
  "about", "mentions", "sameAs", "brand", "authorSameAs", "offers", 
  "faq", "video", "howtoSteps", "reviews", "aggregateRating"
];

const VALID_STRICTNESS = ["lenient", "normal", "strict"];

const VALID_RENDER_MODES = ["auto", "html", "headless"];

const VALID_SIGNALS = ["byline", "price", "rating", "sku", "map", "steps", "dates"];

export function parseHint(hint: string): HintDirective {
  if (!hint.trim()) {
    return {};
  }

  const directive: HintDirective = {};
  const text = hint.toLowerCase();

  // Parse preferred type
  for (const type of VALID_TYPES) {
    if (text.includes(type.toLowerCase())) {
      directive.preferredType = type;
      break;
    }
  }

  // Parse profile
  for (const profile of VALID_PROFILES) {
    if (text.includes(profile)) {
      directive.profile = profile;
      break;
    }
  }

  // Parse strictness
  for (const strictness of VALID_STRICTNESS) {
    if (text.includes(strictness)) {
      directive.strictness = strictness;
      break;
    }
  }

  // Parse render mode
  for (const mode of VALID_RENDER_MODES) {
    if (text.includes(mode)) {
      directive.renderMode = mode;
      break;
    }
  }

  // Parse language (look for common language codes)
  const langMatch = text.match(/\b(en|es|fr|de|it|pt|sv|da|no|fi|nl|pl|ru|ja|ko|zh|ar)\b/);
  if (langMatch) {
    directive.language = langMatch[1];
  }

  // Parse BCP-47 language codes
  const bcpMatch = text.match(/\b([a-z]{2}-[A-Z]{2})\b/);
  if (bcpMatch) {
    directive.language = bcpMatch[1];
  }

  // Parse max items
  const maxItemsMatch = text.match(/cap\s+(\d+)|max\s+(\d+)|limit\s+(\d+)/);
  if (maxItemsMatch) {
    directive.maxItems = parseInt(maxItemsMatch[1] || maxItemsMatch[2] || maxItemsMatch[3]);
  }

  // Parse enrich/suppress features
  directive.enrich = [];
  directive.suppress = [];

  for (const feature of VALID_FEATURES) {
    if (text.includes(`include ${feature}`) || text.includes(`add ${feature}`) || text.includes(`enrich ${feature}`)) {
      directive.enrich.push(feature);
    }
    if (text.includes(`ignore ${feature}`) || text.includes(`suppress ${feature}`) || text.includes(`no ${feature}`)) {
      directive.suppress.push(feature);
    }
  }

  // Parse priority signals
  directive.prioritySignals = [];
  for (const signal of VALID_SIGNALS) {
    if (text.includes(signal)) {
      directive.prioritySignals.push(signal);
    }
  }

  return directive;
}
