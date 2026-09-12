export interface BreadcrumbStep {
  name: string;
  href: string;
}

// Lets Google render a breadcrumb trail in search results instead of a raw
// URL. Google explicitly discounts a BreadcrumbList that doesn't match
// something visible on the page, so this is always paired with
// SiteBreadcrumbs rendering the same steps.
export function buildBreadcrumbJsonLd(steps: BreadcrumbStep[], current: BreadcrumbStep, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ...steps.map((step, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: step.name,
        item: `${siteUrl}${step.href}`,
      })),
      { "@type": "ListItem", position: steps.length + 1, name: current.name, item: `${siteUrl}${current.href}` },
    ],
  };
}
