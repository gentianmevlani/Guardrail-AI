/**
 * Unified Loading State System for guardrail
 * 
 * All loaders share consistent theming (zinc-900 backgrounds), 
 * animation timing (pulse/shimmer), and accessibility features.
 */

export { CardSkeleton } from './card-skeleton';
export { InlineLoader } from './inline-loader';
export { PageLoader } from './page-loader';
export { SectionLoader } from './section-loader';
export { TableSkeleton } from './table-skeleton';

/**
 * USAGE EXAMPLES:
 * 
 * // Full page loading
 * <PageLoader size="lg" message="Loading dashboard..." />
 * 
 * // Section/card loading
 * <SectionLoader size="md" message="Loading scan results..." />
 * 
 * // Table skeleton
 * <TableSkeleton rows={10} columns={5} showHeader />
 * 
 * // Card skeleton
 * <CardSkeleton showAvatar showTitle lines={3} showActions />
 * 
 * // Inline loader for buttons
 * <InlineLoader size="sm" variant="spinner" />
 * <InlineLoader size="xs" variant="dots" label="Saving..." />
 * 
 * // With custom styling
 * <PageLoader className="bg-opacity-100" message="Custom message" />
 */
