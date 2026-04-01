/**
 * App Surface Discovery
 *
 * Discovers all testable elements in the app:
 * - Routes (from links, router config, redirects)
 * - Interactive elements (buttons, links, tabs, accordions)
 * - Forms (with their fields and validation)
 * - API endpoints (from network interception)
 */

import type { Page } from "@playwright/test";

// Type for element info extracted from browser context
interface ElementInfo {
  tag: string;
  text: string;
  id: string;
  className?: string;
  type?: string;
  ariaLabel: string;
  dataTestId?: string;
  disabled?: boolean;
  idx: number;
}

interface LinkInfo {
  href: string;
  text?: string;
}

interface FormInfo {
  id: string;
  action: string;
  method: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    placeholder: string;
    pattern: string;
    selector: string;
  }>;
  submitSelector?: string;
  idx: number;
}
import type {
  AppSurface,
  DiscoveredRoute,
  DiscoveredElement,
  DiscoveredForm,
  DiscoveredAPI,
  FormField,
} from "./types";

// Patterns that indicate destructive actions
const DESTRUCTIVE_PATTERNS = [
  /delete/i,
  /remove/i,
  /destroy/i,
  /cancel.*subscription/i,
  /deactivate/i,
  /terminate/i,
  /close.*account/i,
  /reset.*all/i,
];

// Patterns that indicate auth-required routes
const AUTH_ROUTE_PATTERNS = [
  /\/admin/i,
  /\/dashboard/i,
  /\/settings/i,
  /\/profile/i,
  /\/account/i,
  /\/billing/i,
  /\/api\/.*private/i,
];

export class SurfaceDiscovery {
  private surface: AppSurface = {
    routes: [],
    elements: [],
    forms: [],
    apis: [],
    timestamp: new Date().toISOString(),
  };

  private visitedUrls = new Set<string>();
  private discoveredSelectors = new Set<string>();
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Main discovery entry point - crawls the page and discovers everything
   */
  async discoverPage(page: Page): Promise<AppSurface> {
    const currentUrl = page.url();

    // Discover routes from links
    await this.discoverRoutes(page);

    // Discover interactive elements
    await this.discoverElements(page, currentUrl);

    // Discover forms
    await this.discoverForms(page, currentUrl);

    // API discovery happens via network interception (setup separately)

    this.surface.timestamp = new Date().toISOString();
    return this.surface;
  }

  /**
   * Discover all navigable routes from the current page
   */
  private async discoverRoutes(page: Page): Promise<void> {
    // Get all links
    const links: LinkInfo[] = await page.$$eval("a[href]", (anchors) =>
      anchors.map((a) => ({
        href: a.getAttribute("href") || "",
        text: a.textContent?.trim() || "",
      })),
    );

    for (const link of links) {
      const href = link.href;

      // Skip external links, anchors, javascript
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        continue;
      }

      // Normalize URL
      let fullUrl: string;
      try {
        fullUrl = new URL(href, this.baseUrl).pathname;
      } catch {
        continue;
      }

      // Check if already discovered
      if (this.visitedUrls.has(fullUrl)) continue;
      this.visitedUrls.add(fullUrl);

      const route: DiscoveredRoute = {
        path: fullUrl,
        method: "GET",
        source: "link",
        requiresAuth: AUTH_ROUTE_PATTERNS.some((p) => p.test(fullUrl)),
        visited: false,
      };

      this.surface.routes.push(route);
    }

    // Also check for Next.js/React Router links
    const routerLinks: LinkInfo[] = await page.$$eval(
      '[data-href], [href^="/"]',
      (elements) =>
        elements.map((el) => ({
          href: el.getAttribute("data-href") || el.getAttribute("href") || "",
        })),
    );

    for (const link of routerLinks) {
      const path = link.href;
      if (!path || this.visitedUrls.has(path)) continue;

      this.visitedUrls.add(path);
      this.surface.routes.push({
        path,
        method: "GET",
        source: "router",
        requiresAuth: AUTH_ROUTE_PATTERNS.some((p) => p.test(path)),
        visited: false,
      });
    }
  }

  /**
   * Discover all interactive elements on the page
   */
  private async discoverElements(
    page: Page,
    currentPage: string,
  ): Promise<void> {
    // Buttons
    const buttons: ElementInfo[] = await page.$$eval(
      'button, [role="button"], input[type="submit"], input[type="button"]',
      (elements) =>
        elements.map((el, idx) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim() || el.getAttribute("value") || "",
          id: el.id || "",
          className: (el.className as string) || "",
          type: el.getAttribute("type") || "",
          ariaLabel: el.getAttribute("aria-label") || "",
          dataTestId: el.getAttribute("data-testid") || "",
          disabled: (el as HTMLButtonElement).disabled,
          idx,
        })),
    );

    for (const btn of buttons) {
      if (btn.disabled) continue;

      const selector = this.buildSelector(btn);
      if (this.discoveredSelectors.has(selector)) continue;
      this.discoveredSelectors.add(selector);

      const text =
        btn.text || btn.ariaLabel || btn.dataTestId || `Button ${btn.idx}`;
      const isDestructive = DESTRUCTIVE_PATTERNS.some((p) => p.test(text));

      this.surface.elements.push({
        id: `btn-${this.surface.elements.length}`,
        selector,
        type: "button",
        text,
        page: currentPage,
        isDestructive,
        tested: false,
      });
    }

    // Modal triggers
    const modalTriggers: ElementInfo[] = await page.$$eval(
      '[data-toggle="modal"], [aria-haspopup="dialog"], [aria-controls*="modal"]',
      (elements) =>
        elements.map((el, idx) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim() || "",
          id: el.id || "",
          ariaLabel: el.getAttribute("aria-label") || "",
          dataTestId: el.getAttribute("data-testid") || "",
          idx,
        })),
    );

    for (const trigger of modalTriggers) {
      const selector = this.buildSelector(trigger);
      if (this.discoveredSelectors.has(selector)) continue;
      this.discoveredSelectors.add(selector);

      this.surface.elements.push({
        id: `modal-${this.surface.elements.length}`,
        selector,
        type: "modal-trigger",
        text: trigger.text || trigger.ariaLabel || "Modal trigger",
        page: currentPage,
        isDestructive: false,
        tested: false,
      });
    }

    // Dropdowns
    const dropdowns: ElementInfo[] = await page.$$eval(
      '[role="combobox"], [aria-haspopup="listbox"], select, [data-dropdown]',
      (elements) =>
        elements.map((el, idx) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().slice(0, 50) || "",
          id: el.id || "",
          ariaLabel: el.getAttribute("aria-label") || "",
          idx,
        })),
    );

    for (const dropdown of dropdowns) {
      const selector = this.buildSelector(dropdown);
      if (this.discoveredSelectors.has(selector)) continue;
      this.discoveredSelectors.add(selector);

      this.surface.elements.push({
        id: `dropdown-${this.surface.elements.length}`,
        selector,
        type: "dropdown",
        text: dropdown.ariaLabel || dropdown.text || "Dropdown",
        page: currentPage,
        isDestructive: false,
        tested: false,
      });
    }

    // Tabs
    const tabs: ElementInfo[] = await page.$$eval(
      '[role="tab"], [data-tab], .tab',
      (elements) =>
        elements.map((el, idx) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim() || "",
          id: el.id || "",
          ariaLabel: el.getAttribute("aria-label") || "",
          idx,
        })),
    );

    for (const tab of tabs) {
      const selector = this.buildSelector(tab);
      if (this.discoveredSelectors.has(selector)) continue;
      this.discoveredSelectors.add(selector);

      this.surface.elements.push({
        id: `tab-${this.surface.elements.length}`,
        selector,
        type: "tab",
        text: tab.text || tab.ariaLabel || "Tab",
        page: currentPage,
        isDestructive: false,
        tested: false,
      });
    }

    // Accordions
    const accordions: ElementInfo[] = await page.$$eval(
      "[data-accordion], [aria-expanded], details > summary",
      (elements) =>
        elements.map((el, idx) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().slice(0, 50) || "",
          id: el.id || "",
          ariaLabel: el.getAttribute("aria-label") || "",
          idx,
        })),
    );

    for (const accordion of accordions) {
      const selector = this.buildSelector(accordion);
      if (this.discoveredSelectors.has(selector)) continue;
      this.discoveredSelectors.add(selector);

      this.surface.elements.push({
        id: `accordion-${this.surface.elements.length}`,
        selector,
        type: "accordion",
        text: accordion.text || "Accordion",
        page: currentPage,
        isDestructive: false,
        tested: false,
      });
    }
  }

  /**
   * Discover all forms on the page
   */
  private async discoverForms(page: Page, currentPage: string): Promise<void> {
    const forms: FormInfo[] = await page.$$eval("form", (formElements) =>
      formElements.map((form, idx) => {
        const fields: Array<{
          name: string;
          type: string;
          required: boolean;
          placeholder: string;
          pattern: string;
          selector: string;
        }> = [];

        // Get all input fields
        form
          .querySelectorAll("input, textarea, select")
          .forEach((field, fieldIdx) => {
            const input = field as HTMLInputElement;
            fields.push({
              name: input.name || input.id || `field-${fieldIdx}`,
              type: input.type || field.tagName.toLowerCase(),
              required: input.required,
              placeholder: input.placeholder || "",
              pattern: input.pattern || "",
              selector: input.id ? `#${input.id}` : `[name="${input.name}"]`,
            });
          });

        // Find submit button
        const submitBtn = form.querySelector(
          'button[type="submit"], input[type="submit"]',
        );

        return {
          id: form.id || `form-${idx}`,
          action: form.action || "",
          method: form.method?.toUpperCase() || "POST",
          fields,
          submitSelector: submitBtn
            ? submitBtn.id
              ? `#${submitBtn.id}`
              : 'button[type="submit"]'
            : undefined,
          idx,
        };
      }),
    );

    for (const formData of forms) {
      const selector = formData.id
        ? `#${formData.id}`
        : `form:nth-of-type(${formData.idx + 1})`;

      const form: DiscoveredForm = {
        id: `form-${this.surface.forms.length}`,
        selector,
        page: currentPage,
        action: formData.action,
        method: formData.method,
        fields: formData.fields.map(
          (f): FormField => ({
            name: f.name,
            type: f.type,
            required: f.required,
            selector: f.selector,
            placeholder: f.placeholder,
            pattern: f.pattern,
          }),
        ),
        submitButton: formData.submitSelector,
        tested: false,
      };

      this.surface.forms.push(form);
    }
  }

  /**
   * Add an API call discovered via network interception
   */
  addDiscoveredAPI(api: DiscoveredAPI): void {
    // Avoid duplicates
    const exists = this.surface.apis.some(
      (a) => a.url === api.url && a.method === api.method,
    );
    if (!exists) {
      this.surface.apis.push(api);
    }
  }

  /**
   * Add a route discovered via redirect or API call
   */
  addDiscoveredRoute(route: DiscoveredRoute): void {
    if (!this.visitedUrls.has(route.path)) {
      this.visitedUrls.add(route.path);
      this.surface.routes.push(route);
    }
  }

  /**
   * Build a stable selector for an element
   */
  private buildSelector(el: {
    id?: string;
    dataTestId?: string;
    ariaLabel?: string;
    className?: string;
    tag?: string;
    idx?: number;
  }): string {
    // Prefer stable selectors
    if (el.dataTestId) return `[data-testid="${el.dataTestId}"]`;
    if (el.id) return `#${el.id}`;
    if (el.ariaLabel) return `[aria-label="${el.ariaLabel}"]`;

    // Fallback to nth-of-type
    return `${el.tag || "button"}:nth-of-type(${(el.idx || 0) + 1})`;
  }

  /**
   * Get the current surface
   */
  getSurface(): AppSurface {
    return this.surface;
  }

  /**
   * Get discovery stats
   */
  getStats(): {
    routes: number;
    elements: number;
    forms: number;
    apis: number;
  } {
    return {
      routes: this.surface.routes.length,
      elements: this.surface.elements.length,
      forms: this.surface.forms.length,
      apis: this.surface.apis.length,
    };
  }
}
