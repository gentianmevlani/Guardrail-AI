import { NextResponse } from 'next/server';

interface ChangelogEntry {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  features: string[];
  fixes: string[];
  breaking?: string[];
  security?: string[];
  documentation?: string[];
}

const changelogData: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2026-01-05",
    type: "minor",
    features: [
      "Added documentation search with Pagefind integration",
      "Implemented code copy buttons with syntax highlighting",
      "Created individual blog post pages with full articles",
      "Built comprehensive changelog page with RSS feed",
      "Added interactive code examples for CLI commands",
    ],
    fixes: [
      "Fixed GitHub rate limiting issues in CLI",
      "Resolved memory leak in long-running scans",
      "Improved error messages for failed deployments",
    ],
    documentation: [
      "Added CLI reference documentation",
      "Created integration guides for CI/CD platforms",
      "Documented Reality Mode configuration options",
    ],
  },
  {
    version: "1.1.0",
    date: "2025-12-28",
    type: "minor",
    features: [
      "Introduced Reality Mode for mock data detection",
      "Added Ship Check GO/NO-GO validation",
      "Implemented MCP server for Claude Desktop integration",
      "Created VS Code extension for real-time feedback",
    ],
    fixes: [
      "Fixed false positives in security scanning",
      "Resolved installation issues on Windows",
      "Improved performance of large codebase scans",
    ],
    security: [
      "Updated dependency scanning for CVE-2025-1234",
      "Enhanced secret detection patterns",
    ],
  },
  {
    version: "1.0.0",
    date: "2025-12-15",
    type: "major",
    features: [
      "Initial release of guardrail CLI",
      "Security scanning with OWASP Top 10 compliance",
      "CI/CD integration for GitHub Actions and GitLab",
      "Basic code quality analysis",
      "Team collaboration features",
    ],
    fixes: [],
    documentation: [
      "Getting started guide",
      "Installation documentation",
      "API reference",
    ],
  },
  {
    version: "0.9.0",
    date: "2025-12-01",
    type: "minor",
    features: [
      "Beta release with core scanning functionality",
      "Mock data detection prototype",
      "Basic CLI interface",
    ],
    fixes: [
      "Fixed crash on empty directories",
      "Improved error handling for network timeouts",
    ],
  },
];

function generateRSSXML(entries: ChangelogEntry[]): string {
  const items = entries.map(entry => {
    const categories = [];
    if (entry.features.length > 0) categories.push('features');
    if (entry.fixes.length > 0) categories.push('fixes');
    if (entry.breaking?.length) categories.push('breaking');
    if (entry.security?.length) categories.push('security');
    if (entry.documentation?.length) categories.push('documentation');

    const description = [
      entry.features.length > 0 && `<h3>✨ New Features</h3><ul>${entry.features.map(f => `<li>${f}</li>`).join('')}</ul>`,
      entry.fixes.length > 0 && `<h3>🐛 Bug Fixes</h3><ul>${entry.fixes.map(f => `<li>${f}</li>`).join('')}</ul>`,
      entry.breaking?.length && `<h3>💥 Breaking Changes</h3><ul>${entry.breaking.map(f => `<li>${f}</li>`).join('')}</ul>`,
      entry.security?.length && `<h3>🔒 Security Updates</h3><ul>${entry.security.map(f => `<li>${f}</li>`).join('')}</ul>`,
      entry.documentation?.length && `<h3>📚 Documentation</h3><ul>${entry.documentation.map(f => `<li>${f}</li>`).join('')}</ul>`,
    ].filter(Boolean).join('');

    return `
      <item>
        <title>guardrail ${entry.version}</title>
        <description><![CDATA[${description}]]></description>
        <link>https://guardrailai.dev/changelog#${entry.version}</link>
        <guid>https://guardrailai.dev/changelog#${entry.version}</guid>
        <pubDate>${new Date(entry.date).toUTCString()}</pubDate>
        ${categories.map(cat => `<category>${cat}</category>`).join('')}
      </item>
    `.trim();
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>guardrail Changelog</title>
    <description>Stay up to date with the latest features, improvements, and fixes in guardrail</description>
    <link>https://guardrailai.dev/changelog</link>
    <atom:link href="https://guardrailai.dev/changelog/feed.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${new Date(changelogData[0].date).toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
}

export async function GET() {
  const rssXML = generateRSSXML(changelogData);
  
  return new NextResponse(rssXML, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
    },
  });
}
