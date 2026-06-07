import type { Activity, ActivityCategory } from '@/types';

// ─── Outdoor ──────────────────────────────────────────────────────────────────
const outdoor: Activity[] = [
  { id: 'hiking',       name: 'Hiking',          emoji: '🥾', category: 'outdoor' },
  { id: 'beach',        name: 'Beach Day',        emoji: '🏖️', category: 'outdoor' },
  { id: 'cycling',      name: 'Cycling',          emoji: '🚴', category: 'outdoor' },
  { id: 'camping',      name: 'Camping',          emoji: '⛺', category: 'outdoor' },
  { id: 'kayaking',     name: 'Kayaking',         emoji: '🛶', category: 'outdoor' },
  { id: 'rock-climbing',name: 'Rock Climbing',    emoji: '🧗', category: 'outdoor' },
  { id: 'picnic',       name: 'Picnic',           emoji: '🧺', category: 'outdoor' },
  { id: 'surfing',      name: 'Surfing',          emoji: '🏄', category: 'outdoor' },
];

// ─── Social ───────────────────────────────────────────────────────────────────
const social: Activity[] = [
  { id: 'museum',       name: 'Museum Tour',      emoji: '🏛️', category: 'social' },
  { id: 'art-gallery',  name: 'Art Gallery',      emoji: '🖼️', category: 'social' },
  { id: 'farmers-market',name: 'Farmers Market',  emoji: '🛒', category: 'social' },
  { id: 'trivia-night', name: 'Trivia Night',     emoji: '🧠', category: 'social' },
  { id: 'karaoke',      name: 'Karaoke',          emoji: '🎤', category: 'social' },
  { id: 'escape-room',  name: 'Escape Room',      emoji: '🔐', category: 'social' },
  { id: 'theme-park',   name: 'Theme Park',       emoji: '🎢', category: 'social' },
];

// ─── Fitness ──────────────────────────────────────────────────────────────────
const fitness: Activity[] = [
  { id: 'gym',          name: 'Gym Workout',      emoji: '🏋️', category: 'fitness' },
  { id: 'yoga',         name: 'Yoga',             emoji: '🧘', category: 'fitness' },
  { id: 'running',      name: 'Running',          emoji: '🏃', category: 'fitness' },
  { id: 'tennis',       name: 'Tennis',           emoji: '🎾', category: 'fitness' },
  { id: 'basketball',   name: 'Basketball',       emoji: '🏀', category: 'fitness' },
  { id: 'swimming',     name: 'Swimming',         emoji: '🏊', category: 'fitness' },
  { id: 'pilates',      name: 'Pilates',          emoji: '🤸', category: 'fitness' },
  { id: 'dance',        name: 'Dance Class',      emoji: '💃', category: 'fitness' },
];

// ─── Entertainment ────────────────────────────────────────────────────────────
const entertainment: Activity[] = [
  { id: 'movies',       name: 'Movies',           emoji: '🎬', category: 'entertainment' },
  { id: 'gaming',       name: 'Gaming',           emoji: '🎮', category: 'entertainment' },
  { id: 'concert',      name: 'Concert',          emoji: '🎶', category: 'entertainment' },
  { id: 'comedy-show',  name: 'Comedy Show',      emoji: '🎭', category: 'entertainment' },
  { id: 'bowling',      name: 'Bowling',          emoji: '🎳', category: 'entertainment' },
  { id: 'arcade',       name: 'Arcade',           emoji: '🕹️', category: 'entertainment' },
];

// ─── Food ─────────────────────────────────────────────────────────────────────
const food: Activity[] = [
  { id: 'restaurant',   name: 'Restaurant',       emoji: '🍽️', category: 'food' },
  { id: 'cooking',      name: 'Cooking Together', emoji: '👨‍🍳', category: 'food' },
  { id: 'coffee',       name: 'Coffee Chat',      emoji: '☕', category: 'food' },
  { id: 'food-tour',    name: 'Food Tour',        emoji: '🗺️', category: 'food' },
  { id: 'brunch',       name: 'Brunch',           emoji: '🥞', category: 'food' },
];

// ─── Learning ─────────────────────────────────────────────────────────────────
const learning: Activity[] = [
  { id: 'language',     name: 'Language Practice',emoji: '🗣️', category: 'learning' },
  { id: 'study-buddy',  name: 'Study Buddy',      emoji: '📚', category: 'learning' },
  { id: 'coding',       name: 'Coding Session',   emoji: '💻', category: 'learning' },
  { id: 'photography',  name: 'Photography Walk', emoji: '📷', category: 'learning' },
  { id: 'book-club',    name: 'Book Club',        emoji: '📖', category: 'learning' },
];

// ─── Practical ────────────────────────────────────────────────────────────────
const practical: Activity[] = [
  { id: 'moving-help',  name: 'Moving Help',      emoji: '📦', category: 'practical' },
  { id: 'shopping',     name: 'Shopping Trip',    emoji: '🛍️', category: 'practical' },
  { id: 'errands',      name: 'Errands',          emoji: '✅', category: 'practical' },
  { id: 'airport',      name: 'Airport Pickup',   emoji: '✈️', category: 'practical' },
  { id: 'furniture',    name: 'Furniture Assembly',emoji: '🔧', category: 'practical' },
];

// ─── Master list & category map ──────────────────────────────────────────────

export const ACTIVITIES: Activity[] = [
  ...outdoor,
  ...social,
  ...fitness,
  ...entertainment,
  ...food,
  ...learning,
  ...practical,
];

/** Look up an activity by its stable ID */
export function getActivityById(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

/** Filter activities by category */
export function getActivitiesByCategory(category: ActivityCategory): Activity[] {
  return ACTIVITIES.filter((a) => a.category === category);
}

/** All distinct categories that have at least one activity */
export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  'outdoor',
  'social',
  'fitness',
  'entertainment',
  'food',
  'learning',
  'practical',
];

/** Human-readable labels for each category */
export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  outdoor:       'Outdoor',
  social:        'Social',
  fitness:       'Fitness',
  entertainment: 'Entertainment',
  food:          'Food & Drink',
  learning:      'Learning',
  practical:     'Practical Help',
};

/** Emoji icons for each category (used in filter chips, etc.) */
export const CATEGORY_EMOJIS: Record<ActivityCategory, string> = {
  outdoor:       '🌲',
  social:        '🎉',
  fitness:       '💪',
  entertainment: '🎬',
  food:          '🍔',
  learning:      '📚',
  practical:     '🔧',
};

export default ACTIVITIES;
