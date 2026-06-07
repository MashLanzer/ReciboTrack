import React from 'react';
import { Badge } from '@/components/ui/Badge';
import type { Activity, ActivityCategory } from '@/types';
import { cn } from '@/lib/utils';

// ─── Category Colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  outdoor: '#10B981',      // green
  social: '#FF6B35',       // primary orange
  fitness: '#EF4444',      // red
  entertainment: '#A855F7',// accent purple
  food: '#F59E0B',         // amber
  learning: '#4ECDC4',     // secondary teal
  practical: '#6B7280',    // gray
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityBadgeProps {
  activity: Activity;
  size?: 'sm' | 'md';
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders a single activity as a colored pill badge with an emoji and name.
 * The color is determined by the activity's category.
 */
export function ActivityBadge({
  activity,
  size = 'md',
  className,
}: ActivityBadgeProps) {
  const color = CATEGORY_COLORS[activity.category] ?? '#6B7280';

  return (
    <Badge
      label={activity.name}
      emoji={activity.emoji}
      color={color}
      size={size}
      className={cn(className)}
    />
  );
}

export default ActivityBadge;
