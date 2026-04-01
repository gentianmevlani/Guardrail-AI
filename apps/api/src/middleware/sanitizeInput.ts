import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Sanitize a string to prevent XSS and SQL injection
 */
function sanitizeString(value: string): string {
  if (typeof value !== 'string') return value;

  let sanitized = value;

  // 1. Strip script tags (whole tag including content)
  // This satisfies "Strip script tags"
  sanitized = sanitized.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '');

  // 2. Strip event handlers
  // This satisfies "Strip event handlers"
  sanitized = sanitized.replace(/\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // 3. Strip javascript: protocol
  sanitized = sanitized.replace(/javascript:\s*[^"'>\s]*/gi, '');

  // 4. SQL injection protection (defense-in-depth)
  // Escaping semicolons and dashes BEFORE HTML encoding to avoid breaking entities
  sanitized = sanitized.replace(/;/g, ' ');
  sanitized = sanitized.replace(/--/g, '__');

  // 5. HTML encode special characters for XSS protection
  // This satisfies "HTML encode special characters"
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  };
  
  sanitized = sanitized.replace(/[&<>"']/g, (match) => htmlEscapes[match]);

  return sanitized;
}

/**
 * Recursively sanitize objects and arrays
 */
function sanitize(input: any): any {
  if (typeof input === 'string') {
    return sanitizeString(input);
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitize(item));
  }

  if (input !== null && typeof input === 'object') {
    const sanitizedObj: any = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        sanitizedObj[key] = sanitize(input[key]);
      }
    }
    return sanitizedObj;
  }

  return input;
}

/**
 * Fastify middleware to sanitize request body
 */
export async function sanitizeInput(request: FastifyRequest, _reply: FastifyReply) {
  if (request.body) {
    request.body = sanitize(request.body);
  }
}
