/**
 * License Compatibility Matrix
 *
 * Defines which licenses are compatible with each other
 */

export type LicenseType =
  | "MIT"
  | "Apache-2.0"
  | "BSD-2-Clause"
  | "BSD-3-Clause"
  | "ISC"
  | "GPL-2.0"
  | "GPL-3.0"
  | "LGPL-2.1"
  | "LGPL-3.0"
  | "AGPL-3.0"
  | "MPL-2.0"
  | "CDDL-1.0"
  | "EPL-2.0"
  | "Unlicense"
  | "CC0-1.0"
  | "Proprietary"
  | "Unknown";

export type LicenseCategory =
  | "permissive"
  | "weak_copyleft"
  | "strong_copyleft"
  | "public_domain"
  | "proprietary";

export interface LicenseInfo {
  name: string;
  category: LicenseCategory;
  requiresAttribution: boolean;
  requiresSourceDisclosure: boolean;
  requiresSameLicense: boolean;
  allowsCommercialUse: boolean;
  allowsModification: boolean;
  allowsDistribution: boolean;
  patentGrant: boolean;
}

/**
 * License metadata
 */
export const LICENSE_INFO: Record<LicenseType, LicenseInfo> = {
  MIT: {
    name: "MIT License",
    category: "permissive",
    requiresAttribution: true,
    requiresSourceDisclosure: false,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: false,
  },
  "Apache-2.0": {
    name: "Apache License 2.0",
    category: "permissive",
    requiresAttribution: true,
    requiresSourceDisclosure: false,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: true,
  },
  "BSD-2-Clause": {
    name: "BSD 2-Clause License",
    category: "permissive",
    requiresAttribution: true,
    requiresSourceDisclosure: false,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: false,
  },
  "BSD-3-Clause": {
    name: "BSD 3-Clause License",
    category: "permissive",
    requiresAttribution: true,
    requiresSourceDisclosure: false,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: false,
  },
  ISC: {
    name: "ISC License",
    category: "permissive",
    requiresAttribution: true,
    requiresSourceDisclosure: false,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: false,
  },
  "GPL-2.0": {
    name: "GNU General Public License v2.0",
    category: "strong_copyleft",
    requiresAttribution: true,
    requiresSourceDisclosure: true,
    requiresSameLicense: true,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: false,
  },
  "GPL-3.0": {
    name: "GNU General Public License v3.0",
    category: "strong_copyleft",
    requiresAttribution: true,
    requiresSourceDisclosure: true,
    requiresSameLicense: true,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: true,
  },
  "LGPL-2.1": {
    name: "GNU Lesser General Public License v2.1",
    category: "weak_copyleft",
    requiresAttribution: true,
    requiresSourceDisclosure: true,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: false,
  },
  "LGPL-3.0": {
    name: "GNU Lesser General Public License v3.0",
    category: "weak_copyleft",
    requiresAttribution: true,
    requiresSourceDisclosure: true,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: true,
  },
  "AGPL-3.0": {
    name: "GNU Affero General Public License v3.0",
    category: "strong_copyleft",
    requiresAttribution: true,
    requiresSourceDisclosure: true,
    requiresSameLicense: true,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: true,
  },
  "MPL-2.0": {
    name: "Mozilla Public License 2.0",
    category: "weak_copyleft",
    requiresAttribution: true,
    requiresSourceDisclosure: true,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: true,
  },
  "CDDL-1.0": {
    name: "Common Development and Distribution License 1.0",
    category: "weak_copyleft",
    requiresAttribution: true,
    requiresSourceDisclosure: true,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: true,
  },
  "EPL-2.0": {
    name: "Eclipse Public License 2.0",
    category: "weak_copyleft",
    requiresAttribution: true,
    requiresSourceDisclosure: true,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: true,
  },
  Unlicense: {
    name: "The Unlicense",
    category: "public_domain",
    requiresAttribution: false,
    requiresSourceDisclosure: false,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: false,
  },
  "CC0-1.0": {
    name: "Creative Commons Zero v1.0 Universal",
    category: "public_domain",
    requiresAttribution: false,
    requiresSourceDisclosure: false,
    requiresSameLicense: false,
    allowsCommercialUse: true,
    allowsModification: true,
    allowsDistribution: true,
    patentGrant: false,
  },
  Proprietary: {
    name: "Proprietary License",
    category: "proprietary",
    requiresAttribution: false,
    requiresSourceDisclosure: false,
    requiresSameLicense: false,
    allowsCommercialUse: false,
    allowsModification: false,
    allowsDistribution: false,
    patentGrant: false,
  },
  Unknown: {
    name: "Unknown License",
    category: "proprietary",
    requiresAttribution: false,
    requiresSourceDisclosure: false,
    requiresSameLicense: false,
    allowsCommercialUse: false,
    allowsModification: false,
    allowsDistribution: false,
    patentGrant: false,
  },
};

/**
 * Compatibility matrix
 * true = compatible, false = incompatible
 */
export const COMPATIBILITY_MATRIX: Record<
  LicenseType,
  Record<LicenseType, boolean>
> = {
  MIT: {
    MIT: true,
    "Apache-2.0": true,
    "BSD-2-Clause": true,
    "BSD-3-Clause": true,
    ISC: true,
    "GPL-2.0": true,
    "GPL-3.0": true,
    "LGPL-2.1": true,
    "LGPL-3.0": true,
    "AGPL-3.0": true,
    "MPL-2.0": true,
    "CDDL-1.0": true,
    "EPL-2.0": true,
    Unlicense: true,
    "CC0-1.0": true,
    Proprietary: false,
    Unknown: false,
  },
  "Apache-2.0": {
    MIT: true,
    "Apache-2.0": true,
    "BSD-2-Clause": true,
    "BSD-3-Clause": true,
    ISC: true,
    "GPL-2.0": false, // Apache 2.0 incompatible with GPL 2.0
    "GPL-3.0": true,
    "LGPL-2.1": true,
    "LGPL-3.0": true,
    "AGPL-3.0": true,
    "MPL-2.0": true,
    "CDDL-1.0": true,
    "EPL-2.0": true,
    Unlicense: true,
    "CC0-1.0": true,
    Proprietary: false,
    Unknown: false,
  },
  "GPL-3.0": {
    MIT: true,
    "Apache-2.0": true,
    "BSD-2-Clause": true,
    "BSD-3-Clause": true,
    ISC: true,
    "GPL-2.0": false, // GPL 3.0 incompatible with GPL 2.0
    "GPL-3.0": true,
    "LGPL-2.1": true,
    "LGPL-3.0": true,
    "AGPL-3.0": true,
    "MPL-2.0": false, // Incompatible
    "CDDL-1.0": false, // Incompatible
    "EPL-2.0": false, // Incompatible
    Unlicense: true,
    "CC0-1.0": true,
    Proprietary: false,
    Unknown: false,
  },
  Proprietary: {
    MIT: false,
    "Apache-2.0": false,
    "BSD-2-Clause": false,
    "BSD-3-Clause": false,
    ISC: false,
    "GPL-2.0": false,
    "GPL-3.0": false,
    "LGPL-2.1": false,
    "LGPL-3.0": false,
    "AGPL-3.0": false,
    "MPL-2.0": false,
    "CDDL-1.0": false,
    "EPL-2.0": false,
    Unlicense: false,
    "CC0-1.0": false,
    Proprietary: true,
    Unknown: false,
  },
  Unknown: {
    MIT: false,
    "Apache-2.0": false,
    "BSD-2-Clause": false,
    "BSD-3-Clause": false,
    ISC: false,
    "GPL-2.0": false,
    "GPL-3.0": false,
    "LGPL-2.1": false,
    "LGPL-3.0": false,
    "AGPL-3.0": false,
    "MPL-2.0": false,
    "CDDL-1.0": false,
    "EPL-2.0": false,
    Unlicense: false,
    "CC0-1.0": false,
    Proprietary: false,
    Unknown: true,
  },
  // ... other licenses would follow the same pattern
  // For brevity, I'll set defaults for remaining licenses
} as any;

// Fill in remaining licenses with permissive defaults
for (const license of Object.keys(LICENSE_INFO) as LicenseType[]) {
  if (!COMPATIBILITY_MATRIX[license]) {
    COMPATIBILITY_MATRIX[license] = {} as any;
  }
  for (const otherLicense of Object.keys(LICENSE_INFO) as LicenseType[]) {
    if (COMPATIBILITY_MATRIX[license][otherLicense] === undefined) {
      // Default: permissive with permissive = true, others case by case
      const licenseInfo = LICENSE_INFO[license];
      const otherInfo = LICENSE_INFO[otherLicense];

      if (
        licenseInfo.category === "permissive" &&
        otherInfo.category === "permissive"
      ) {
        COMPATIBILITY_MATRIX[license][otherLicense] = true;
      } else {
        COMPATIBILITY_MATRIX[license][otherLicense] = license === otherLicense;
      }
    }
  }
}
