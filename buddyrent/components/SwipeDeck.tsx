import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SwipeCard } from '@/components/SwipeCard';
import type { Profile } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VISIBLE_CARDS = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SwipeDeckProps {
  profiles: Profile[];
  onSwipeLeft: (id: string) => void;
  onSwipeRight: (id: string) => void;
  onSuperLike?: (id: string) => void;
  onTapCard?: (profile: Profile) => void;
  onEmpty?: () => void;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🔍</Text>
      <Text style={styles.emptyTitle}>No more buddies!</Text>
      <Text style={styles.emptySubtitle}>
        You've seen everyone in your area.{'\n'}Check back later for new buddies.
      </Text>
      {onRefresh && (
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SwipeDeck({
  profiles,
  onSwipeLeft,
  onSwipeRight,
  onSuperLike,
  onTapCard,
  onEmpty,
}: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSwipeLeft = useCallback(
    (id: string) => {
      onSwipeLeft(id);
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= profiles.length && onEmpty) {
          onEmpty();
        }
        return next;
      });
    },
    [onSwipeLeft, profiles.length, onEmpty],
  );

  const handleSwipeRight = useCallback(
    (id: string) => {
      onSwipeRight(id);
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= profiles.length && onEmpty) {
          onEmpty();
        }
        return next;
      });
    },
    [onSwipeRight, profiles.length, onEmpty],
  );

  const handleSuperLike = useCallback(
    (id: string) => {
      if (onSuperLike) onSuperLike(id);
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= profiles.length && onEmpty) {
          onEmpty();
        }
        return next;
      });
    },
    [onSuperLike, profiles.length, onEmpty],
  );

  // Slice visible cards
  const visibleProfiles = profiles.slice(currentIndex, currentIndex + VISIBLE_CARDS);

  if (visibleProfiles.length === 0) {
    return <EmptyState onRefresh={onEmpty} />;
  }

  return (
    <View style={styles.deckContainer}>
      {/*
       * Render cards in reverse order so the top card (index 0) sits on top.
       * Each successive card is slightly smaller and pushed down (stack effect).
       */}
      {visibleProfiles
        .slice()
        .reverse()
        .map((profile, reversedIdx) => {
          const stackIndex = visibleProfiles.length - 1 - reversedIdx;
          const isTop = stackIndex === 0;

          return (
            <SwipeCard
              key={profile.id}
              profile={profile}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onSuperLike={handleSuperLike}
              onTap={onTapCard}
              isTop={isTop}
              index={stackIndex}
            />
          );
        })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  deckContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  refreshButton: {
    marginTop: 16,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 50,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default SwipeDeck;
