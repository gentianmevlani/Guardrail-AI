/**
 * SBOM Output Formatters
 *
 * Serialize SBOMDocument to CycloneDX 1.5 JSON and SPDX 2.3 JSON.
 */

import type { SBOMDocument, SBOMComponent } from './types';

// ─── CycloneDX 1.5 JSON ──────────────────────────────────────

interface CycloneDXBom {
  bomFormat: 'CycloneDX';
  specVersion: '1.5';
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: { components: Array<{ type: string; name: string; version: string; author: string }> };
    component?: CycloneDXComponent;
    authors?: Array<{ name: string; email?: string }>;
  };
  components: CycloneDXComponent[];
  dependencies: Array<{ ref: string; dependsOn: string[] }>;
  vulnerabilities?: CycloneDXVulnerability[];
}

interface CycloneDXComponent {
  type: string;
  name: string;
  version: string;
  purl?: string;
  description?: string;
  'bom-ref'?: string;
  licenses?: Array<{ license: { id?: string; name?: string; url?: string } }>;
  hashes?: Array<{ alg: string; content: string }>;
  externalReferences?: Array<{ type: string; url: string; comment?: string }>;
  scope?: string;
  author?: string;
  supplier?: { name: string };
}

interface CycloneDXVulnerability {
  id: string;
  source: { name: string; url?: string };
  ratings?: Array<{ severity: string }>;
  description?: string;
  recommendation?: string;
  affects?: Array<{ ref: string }>;
}

function componentToCycloneDX(comp: SBOMComponent): CycloneDXComponent {
  const cdx: CycloneDXComponent = {
    type: comp.type,
    name: comp.name,
    version: comp.version,
    'bom-ref': comp.purl || `${comp.name}@${comp.version}`,
  };

  if (comp.purl) cdx.purl = comp.purl;
  if (comp.description) cdx.description = comp.description;
  if (comp.author) cdx.author = comp.author;
  if (comp.supplier) cdx.supplier = { name: comp.supplier };

  if (comp.scope) {
    cdx.scope = comp.scope;
  }

  if (comp.licenses && comp.licenses.length > 0) {
    cdx.licenses = comp.licenses.map(l => ({
      license: {
        id: l.id,
        name: l.name,
        url: l.url,
      },
    }));
  }

  if (comp.hashes && comp.hashes.length > 0) {
    cdx.hashes = comp.hashes.map(h => ({
      alg: h.algorithm,
      content: h.value,
    }));
  }

  if (comp.externalReferences && comp.externalReferences.length > 0) {
    cdx.externalReferences = comp.externalReferences.map(r => ({
      type: r.type,
      url: r.url,
      comment: r.comment,
    }));
  }

  return cdx;
}

export function formatCycloneDX(doc: SBOMDocument): string {
  const bom: CycloneDXBom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: doc.serialNumber,
    version: doc.version,
    metadata: {
      timestamp: doc.metadata.timestamp,
      tools: {
        components: doc.metadata.tools.map(t => ({
          type: 'application',
          name: t.name,
          version: t.version,
          author: t.vendor,
        })),
      },
    },
    components: doc.components.map(componentToCycloneDX),
    dependencies: doc.dependencies.map(d => ({
      ref: d.ref,
      dependsOn: d.dependsOn,
    })),
  };

  if (doc.metadata.component) {
    bom.metadata.component = componentToCycloneDX(doc.metadata.component);
  }

  if (doc.metadata.authors) {
    bom.metadata.authors = doc.metadata.authors;
  }

  if (doc.vulnerabilities && doc.vulnerabilities.length > 0) {
    bom.vulnerabilities = doc.vulnerabilities.map(v => {
      const vuln: CycloneDXVulnerability = {
        id: v.id,
        source: { name: v.source },
      };
      if (v.severity) vuln.ratings = [{ severity: v.severity }];
      if (v.description) vuln.description = v.description;
      if (v.recommendation) vuln.recommendation = v.recommendation;
      return vuln;
    });
  }

  return JSON.stringify(bom, null, 2);
}

// ─── SPDX 2.3 JSON ───────────────────────────────────────────

interface SPDXDocument {
  spdxVersion: 'SPDX-2.3';
  dataLicense: 'CC0-1.0';
  SPDXID: 'SPDXRef-DOCUMENT';
  name: string;
  documentNamespace: string;
  creationInfo: {
    created: string;
    creators: string[];
    licenseListVersion?: string;
  };
  packages: SPDXPackage[];
  relationships: SPDXRelationship[];
}

interface SPDXPackage {
  SPDXID: string;
  name: string;
  versionInfo: string;
  downloadLocation: string;
  filesAnalyzed: boolean;
  licenseConcluded?: string;
  licenseDeclared?: string;
  copyrightText?: string;
  description?: string;
  supplier?: string;
  externalRefs?: Array<{
    referenceCategory: string;
    referenceType: string;
    referenceLocator: string;
  }>;
  checksums?: Array<{
    algorithm: string;
    checksumValue: string;
  }>;
}

interface SPDXRelationship {
  spdxElementId: string;
  relatedSpdxElement: string;
  relationshipType: string;
}

function sanitizeSPDXId(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '-');
}

function componentToSPDX(comp: SBOMComponent, _index: number): SPDXPackage {
  const spdxId = `SPDXRef-Package-${sanitizeSPDXId(comp.name)}-${comp.version}`;

  const pkg: SPDXPackage = {
    SPDXID: spdxId,
    name: comp.name,
    versionInfo: comp.version,
    downloadLocation: comp.purl ? `https://registry.npmjs.org/${comp.name}/-/${comp.name.split('/').pop()}-${comp.version}.tgz` : 'NOASSERTION',
    filesAnalyzed: false,
    licenseConcluded: comp.license || 'NOASSERTION',
    licenseDeclared: comp.license || 'NOASSERTION',
    copyrightText: 'NOASSERTION',
  };

  if (comp.description) pkg.description = comp.description;
  if (comp.supplier) pkg.supplier = `Organization: ${comp.supplier}`;

  if (comp.purl) {
    pkg.externalRefs = [{
      referenceCategory: 'PACKAGE-MANAGER',
      referenceType: 'purl',
      referenceLocator: comp.purl,
    }];
  }

  if (comp.hashes && comp.hashes.length > 0) {
    pkg.checksums = comp.hashes.map(h => ({
      algorithm: h.algorithm,
      checksumValue: h.value,
    }));
  }

  return pkg;
}

export function formatSPDX(doc: SBOMDocument): string {
  const rootName = doc.metadata.component?.name || 'unknown-project';

  const spdx: SPDXDocument = {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: rootName,
    documentNamespace: `https://guardrail.dev/spdx/${doc.serialNumber}`,
    creationInfo: {
      created: doc.metadata.timestamp,
      creators: doc.metadata.tools.map(t => `Tool: ${t.name}-${t.version}`),
    },
    packages: [],
    relationships: [],
  };

  // Add root package
  if (doc.metadata.component) {
    const rootPkg = componentToSPDX(doc.metadata.component, 0);
    rootPkg.SPDXID = 'SPDXRef-RootPackage';
    spdx.packages.push(rootPkg);

    spdx.relationships.push({
      spdxElementId: 'SPDXRef-DOCUMENT',
      relatedSpdxElement: 'SPDXRef-RootPackage',
      relationshipType: 'DESCRIBES',
    });
  }

  // Add all components
  doc.components.forEach((comp, index) => {
    const pkg = componentToSPDX(comp, index);
    spdx.packages.push(pkg);

    // Relate to root package
    if (doc.metadata.component) {
      spdx.relationships.push({
        spdxElementId: 'SPDXRef-RootPackage',
        relatedSpdxElement: pkg.SPDXID,
        relationshipType: 'DEPENDS_ON',
      });
    }
  });

  return JSON.stringify(spdx, null, 2);
}
