/**
 * Safe DOM manipulation utilities to prevent XSS attacks
 *
 * NEVER use innerHTML, outerHTML, or insertAdjacentHTML with user input.
 * Use these utilities instead for safe content injection.
 */

/**
 * Safely sets text content on an element, preventing XSS attacks.
 * Uses textContent which does not parse HTML.
 *
 * @param element - The DOM element to set content on
 * @param text - The text content to set (will NOT be parsed as HTML)
 */
export function safeSetContent(element: HTMLElement, text: string): void {
  element.textContent = text;
}

/**
 * Safely creates a text node from user input.
 *
 * @param text - The text to create a node from
 * @returns A Text node that can be safely appended
 */
export function safeCreateTextNode(text: string): Text {
  return document.createTextNode(text);
}

/**
 * Safely creates an element with text content.
 *
 * @param tagName - The HTML tag name to create
 * @param text - The text content to set
 * @param className - Optional CSS class name(s)
 * @returns The created element with safe text content
 */
export function safeCreateElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (text !== undefined) {
    element.textContent = text;
  }
  if (className) {
    element.className = className;
  }
  return element;
}

/**
 * Safely creates a meta element with sanitized attributes.
 * Only allows alphanumeric characters, hyphens, and underscores in values.
 *
 * @param name - The meta name attribute
 * @param content - The meta content attribute (will be sanitized)
 * @returns The created meta element
 */
export function safeCreateMeta(name: string, content: string): HTMLMetaElement {
  const meta = document.createElement("meta");
  // Sanitize the name to only allow safe characters
  meta.name = name.replace(/[^a-zA-Z0-9\-_]/g, "");
  // For CSRF tokens, we only expect hex characters
  meta.content = content.replace(/[^a-zA-Z0-9\-_]/g, "");
  return meta;
}

/**
 * Escapes HTML entities in a string for safe display.
 * Use this only when you absolutely need to display user content
 * in a context where HTML is expected (e.g., markdown rendering).
 *
 * @param str - The string to escape
 * @returns The escaped string safe for HTML display
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
  };
  return str.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char]);
}

/**
 * Creates a modal dialog with safe content injection.
 *
 * @param options - Modal configuration options
 * @returns The modal container element
 */
export function createSafeModal(options: {
  title: string;
  content: string;
  buttonText?: string;
  onClose?: () => void;
}): HTMLDivElement {
  const { title, content, buttonText = "Got it", onClose } = options;

  // Create modal container
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 bg-black/50 flex items-center justify-center z-50";

  // Create modal content container
  const container = document.createElement("div");
  container.className = "bg-slate-800 rounded-lg p-6 max-w-md mx-4";

  // Create title - safe text content
  const titleEl = document.createElement("h3");
  titleEl.className = "text-lg font-semibold text-white mb-4";
  titleEl.textContent = title;

  // Create content - safe text content in pre element
  const contentEl = document.createElement("pre");
  contentEl.className = "text-sm text-slate-300 whitespace-pre-wrap";
  contentEl.textContent = content;

  // Create close button
  const button = document.createElement("button");
  button.className =
    "mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700";
  button.textContent = buttonText;
  button.addEventListener("click", () => {
    modal.remove();
    onClose?.();
  });

  // Assemble modal
  container.appendChild(titleEl);
  container.appendChild(contentEl);
  container.appendChild(button);
  modal.appendChild(container);

  return modal;
}
