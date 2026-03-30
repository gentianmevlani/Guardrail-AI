/**
 * Empty State Component
 * 
 * Beautiful empty states that AI agents often miss
 * Used when there's no data to display
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Inbox, 
  Search, 
  FileX, 
  FolderOpen,
  Package,
  MessageSquare
} from 'lucide-react';
import './EmptyState.css';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'search' | 'error' | 'empty';
  className?: string;
}

const defaultIcons = {
  default: Inbox,
  search: Search,
  error: FileX,
  empty: FolderOpen,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  className = '',
}) => {
  const IconComponent = !icon && defaultIcons[variant] ? defaultIcons[variant] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`empty-state empty-state--${variant} ${className}`}
    >
      <div className="empty-state__container">
        {icon ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="empty-state__icon"
          >
            {icon}
          </motion.div>
        ) : IconComponent ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="empty-state__icon"
          >
            <IconComponent className="w-16 h-16" />
          </motion.div>
        ) : null}

        <h3 className="empty-state__title">{title}</h3>
        <p className="empty-state__description">{description}</p>

        {(action || secondaryAction) && (
          <div className="empty-state__actions">
            {action && (
              <button
                onClick={action.onClick}
                className="empty-state__button empty-state__button--primary"
              >
                {action.label}
              </button>
            )}
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="empty-state__button empty-state__button--secondary"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Pre-built empty state variants
 */
export const EmptyStates = {
  NoResults: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="search"
      title="No results found"
      description="Try adjusting your search or filters to find what you're looking for."
      {...props}
    />
  ),
  NoData: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="empty"
      title="No data yet"
      description="Get started by adding your first item."
      {...props}
    />
  ),
  NoMessages: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      icon={<MessageSquare className="w-16 h-16" />}
      title="No messages"
      description="You don't have any messages yet. Start a conversation!"
      {...props}
    />
  ),
  NoItems: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      icon={<Package className="w-16 h-16" />}
      title="No items"
      description="There are no items to display. Add your first item to get started."
      {...props}
    />
  ),
};

export default EmptyState;

