"use client";

import { cn } from "@/lib/utils";
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  isActive?: boolean;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  separator?: React.ReactNode;
  showHome?: boolean;
  maxItems?: number;
  className?: string;
  ref?: React.Ref<HTMLElement>;
}

export function Breadcrumb({
  items,
  separator = <ChevronRight className="w-4 h-4 text-zinc-500" />,
  showHome = true,
  maxItems = 5,
  className,
  ref
}: BreadcrumbProps) {
  const pathname = usePathname() || "";
  
  // Generate breadcrumb items from pathname if not provided
  const generateItemsFromPath = (): BreadcrumbItem[] => {
    const pathSegments = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];
    
    // Add home
    if (showHome) {
      items.push({
        label: "Dashboard",
        href: "/dashboard",
        icon: <Home className="w-4 h-4" />
      });
    }
    
    // Build path segments
    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Skip numeric segments (usually IDs)
      if (/^\d+$/.test(segment)) return;
      
      // Format segment name
      const label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      items.push({
        label,
        href: currentPath,
        isActive: index === pathSegments.length - 1
      });
    });
    
    return items;
  };
  
  const breadcrumbItems = items || generateItemsFromPath();
  
  // Truncate items if too many
  const displayItems = breadcrumbItems.length > maxItems
    ? [
        breadcrumbItems[0],
        { label: "...", href: undefined },
        ...breadcrumbItems.slice(-2)
      ]
    : breadcrumbItems;

  return (
    <nav
      ref={ref}
      aria-label="Breadcrumb"
      className={cn("flex items-center space-x-1 text-sm", className)}
    >
      <ol className="flex items-center space-x-1">
        {displayItems.map((item, index) => (
          <li key={index} className="flex items-center space-x-1">
            {index > 0 && separator}
            
            {item.href && !item.isActive ? (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center space-x-1 hover:text-white transition-colors",
                  "text-zinc-400"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span
                className={cn(
                  "flex items-center space-x-1",
                  item.isActive
                    ? "text-white font-medium"
                    : "text-zinc-400"
                )}
                aria-current={item.isActive ? "page" : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Smart Breadcrumb with dynamic routing
interface SmartBreadcrumbProps extends Omit<BreadcrumbProps, 'items'> {
  customRoutes?: Record<string, string>;
  excludePaths?: string[];
}

export function SmartBreadcrumb({
  customRoutes = {},
  excludePaths = [],
  ...props
}: SmartBreadcrumbProps) {
  const pathname = usePathname() || "";
  
  // Check if path should be excluded
  if (excludePaths.some(path => pathname.startsWith(path))) {
    return null;
  }
  
  // Generate items with custom route names
  const generateSmartItems = (): BreadcrumbItem[] => {
    const pathSegments = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];
    
    // Add home
    if (props.showHome !== false) {
      items.push({
        label: "Dashboard",
        href: "/dashboard",
        icon: <Home className="w-4 h-4" />
      });
    }
    
    // Build path segments with custom names
    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Skip numeric segments
      if (/^\d+$/.test(segment)) return;
      
      // Use custom route name if available
      const label = customRoutes[currentPath] || 
        segment
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      
      items.push({
        label,
        href: currentPath,
        isActive: index === pathSegments.length - 1
      });
    });
    
    return items;
  };
  
  return <Breadcrumb {...props} items={generateSmartItems()} />;
}

// Breadcrumb with dropdown for mobile
export function ResponsiveBreadcrumb(props: BreadcrumbProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 text-sm text-zinc-400 hover:text-white"
        aria-label="Toggle breadcrumb navigation"
      >
        <Home className="w-4 h-4" />
        <span>Navigation</span>
        <ChevronRight className={cn(
          "w-4 h-4 transition-transform",
          isOpen && "rotate-90"
        )} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg z-50">
          <Breadcrumb {...props} />
        </div>
      )}
    </div>
  );
}

// Breadcrumb with keyboard navigation
export function KeyboardBreadcrumb(props: BreadcrumbProps) {
  const breadcrumbRef = React.useRef<HTMLElement>(null);
  
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!breadcrumbRef.current) return;
      
      const links = breadcrumbRef.current.querySelectorAll('a');
      const currentIndex = Array.from(links).findIndex(
        link => link === document.activeElement
      );
      
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < links.length - 1) {
            (links[currentIndex + 1] as HTMLElement).focus();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            (links[currentIndex - 1] as HTMLElement).focus();
          }
          break;
        case 'Home':
          e.preventDefault();
          if (links.length > 0) {
            (links[0] as HTMLElement).focus();
          }
          break;
        case 'End':
          e.preventDefault();
          if (links.length > 0) {
            (links[links.length - 1] as HTMLElement).focus();
          }
          break;
      }
    };
    
    const breadcrumb = breadcrumbRef.current;
    if (breadcrumb) {
      breadcrumb.addEventListener('keydown', handleKeyDown);
      return () => breadcrumb.removeEventListener('keydown', handleKeyDown);
    }
  }, []);
  
  return <Breadcrumb ref={breadcrumbRef} {...props} />;
}
