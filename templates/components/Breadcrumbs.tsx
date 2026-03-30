/**
 * Breadcrumb Component
 * 
 * Beautiful breadcrumb navigation that AI agents often miss
 * Automatically tracks route hierarchy
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import './Breadcrumbs.css';

export interface BreadcrumbItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  separator?: React.ReactNode;
  showHome?: boolean;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  separator = <ChevronRight className="w-4 h-4 text-slate-400" />,
  showHome = true,
  className = '',
}) => {
  const location = useLocation();

  // Auto-generate breadcrumbs from path if not provided
  const breadcrumbItems = items || generateBreadcrumbsFromPath(location.pathname, showHome);

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav className={`breadcrumbs ${className}`} aria-label="Breadcrumb">
      <ol className="breadcrumbs__list">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          const isHome = item.path === '/' && showHome;

          return (
            <li key={item.path} className="breadcrumbs__item">
              {isLast ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="breadcrumbs__current"
                >
                  {isHome && <Home className="w-4 h-4" />}
                  {item.icon && !isHome && item.icon}
                  <span>{item.label}</span>
                </motion.span>
              ) : (
                <Link
                  to={item.path}
                  className="breadcrumbs__link"
                >
                  {isHome && <Home className="w-4 h-4" />}
                  {item.icon && !isHome && item.icon}
                  <span>{item.label}</span>
                </Link>
              )}
              {!isLast && (
                <span className="breadcrumbs__separator" aria-hidden="true">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

/**
 * Generate breadcrumbs from pathname
 */
function generateBreadcrumbsFromPath(pathname: string, includeHome: boolean): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];

  if (includeHome) {
    items.push({ label: 'Home', path: '/' });
  }

  const segments = pathname.split('/').filter(Boolean);
  let currentPath = '';

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const label = formatSegmentLabel(segment);
    items.push({
      label,
      path: currentPath,
    });
  });

  return items;
}

/**
 * Format segment label (e.g., "user-profile" -> "User Profile")
 */
function formatSegmentLabel(segment: string): string {
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default Breadcrumbs;

