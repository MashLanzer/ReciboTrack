import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { ActivityBadge } from '@/components/ActivityBadge';
import { getActivityById } from '@/constants/activities';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;
const ROTATION_RANGE = 15;
const ACTION_ZONE = SCREEN_WIDTH * 0.3;
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.5 };

// ─── Types ────────────────────────────────────────────────────────────────────

interface SwipeCardProps {
  profile: Profile;
  onSwipeLeft: (id: string) => void;
  onSwipeRight: (id: string) => void;
  onSuperLike?: (id: string) => void;
  onTap?: (profile: Profile) => void;
  isTop: boolean;
  index: number;
}

type GestureContext = {
  startX: number;
  startY: number;
};

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Text
          key={star}
          style={[
            styles.star,
            { color: star <= Math.round(rating) ? '#FBBF24' : '#D1D5DB' },
          ]}
        >
          ★
        </Text>
      ))}
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SwipeCard({
  profile,
  onSwipeLeft,
  onSwipeRight,
  onSuperLike,
  onTap,
  isTop,
  index,
}: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Resolved activities (top 3)
  const topActivities = profile.activities
    .slice(0, 3)
    .map((id) => getActivityById(id))
    .filter(Boolean) as NonNullable<ReturnType<typeof getActivityById>>[];

  // Stack positioning for non-top cards
  const stackScale = 1 - index * 0.04;
  const stackOffset = index * 10;

  // ── Gesture handler ──────────────────────────────────────────────────────

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_evt, ctx: GestureContext) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
    },
    onActive: (evt, ctx) => {
      translateX.value = ctx.startX + evt.translationX;
      translateY.value = ctx.startY + evt.translationY;
    },
    onEnd: (evt) => {
      const velocityX = evt.velocityX;
      const velocityY = evt.velocityY;

      const isSuperLike =
        translateY.value < -SCREEN_HEIGHT * 0.2 && Math.abs(velocityY) > 800;

      if (isSuperLike) {
        translateY.value = withSpring(
          -SCREEN_HEIGHT * 1.5,
          SPRING_CONFIG,
          () => {
            if (onSuperLike) runOnJS(onSuperLike)(profile.id);
          },
        );
        translateX.value = withSpring(0, SPRING_CONFIG);
        return;
      }

      if (
        translateX.value > SWIPE_THRESHOLD ||
        (velocityX > 1000 && translateX.value > 0)
      ) {
        translateX.value = withSpring(
          SCREEN_WIDTH * 1.5,
          SPRING_CONFIG,
          () => {
            runOnJS(onSwipeRight)(profile.id);
          },
        );
        return;
      }

      if (
        translateX.value < -SWIPE_THRESHOLD ||
        (velocityX < -1000 && translateX.value < 0)
      ) {
        translateX.value = withSpring(
          -SCREEN_WIDTH * 1.5,
          SPRING_CONFIG,
          () => {
            runOnJS(onSwipeLeft)(profile.id);
          },
        );
        return;
      }

      // Snap back
      translateX.value = withSpring(0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
    },
  });

  // ── Animated styles ──────────────────────────────────────────────────────

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-ROTATION_RANGE, 0, ROTATION_RANGE],
      Extrapolate.CLAMP,
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale: isTop ? 1 : stackScale },
      ],
    };
  });

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, ACTION_ZONE],
      [0, 1],
      Extrapolate.CLAMP,
    ),
  }));

  const nopeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-ACTION_ZONE, 0],
      [1, 0],
      Extrapolate.CLAMP,
    ),
  }));

  const superLikeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [-SCREEN_HEIGHT * 0.15, 0],
      [1, 0],
      Extrapolate.CLAMP,
    ),
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  const photoUri = profile.photos?.[0] ?? null;
  const hourlyDisplay =
    profile.hourlyRate != null ? `$${profile.hourlyRate}/hr` : 'Free';

  const handleTap = useCallback(() => {
    if (onTap) {
      onTap(profile);
    } else {
      setIsExpanded((prev) => !prev);
    }
  }, [onTap, profile]);

  const cardContent = (
    <TouchableOpacity
      activeOpacity={0.98}
      onPress={handleTap}
      style={styles.cardInner}
    >
      {/* Photo */}
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={styles.photo}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>
            {profile.name.charAt(0)}
          </Text>
        </View>
      )}

      {/* Gradient overlay simulation */}
      <View style={styles.gradientOverlay} />

      {/* LIKE overlay */}
      <Animated.View
        style={[styles.actionOverlay, styles.likeOverlay, likeOverlayStyle]}
        pointerEvents="none"
      >
        <Text style={styles.likeText}>LIKE</Text>
      </Animated.View>

      {/* NOPE overlay */}
      <Animated.View
        style={[styles.actionOverlay, styles.nopeOverlay, nopeOverlayStyle]}
        pointerEvents="none"
      >
        <Text style={styles.nopeText}>NOPE</Text>
      </Animated.View>

      {/* SUPER overlay */}
      <Animated.View
        style={[styles.actionOverlay, styles.superOverlay, superLikeOverlayStyle]}
        pointerEvents="none"
      >
        <Text style={styles.superText}>SUPER</Text>
      </Animated.View>

      {/* Info panel */}
      <View style={styles.infoPanel}>
        {/* Name, age, rate */}
        <View style={styles.nameRow}>
          <View style={styles.nameGroup}>
            <Text style={styles.nameText} numberOfLines={1}>
              {profile.name}, {profile.age}
            </Text>
            {profile.isVerified && (
              <Text style={styles.verifiedBadge}>✓</Text>
            )}
          </View>
          <Text style={styles.rateText}>{hourlyDisplay}</Text>
        </View>

        {/* Rating */}
        <StarRating rating={profile.rating} />

        {/* Location */}
        {profile.location ? (
          <Text style={styles.locationText} numberOfLines={1}>
            📍 {profile.location}
          </Text>
        ) : null}

        {/* Activity badges */}
        {topActivities.length > 0 && (
          <View style={styles.badgesRow}>
            {topActivities.map((activity) => (
              <ActivityBadge key={activity.id} activity={activity} size="sm" />
            ))}
          </View>
        )}

        {/* Expanded bio */}
        {isExpanded && profile.bio ? (
          <Text style={styles.bioText} numberOfLines={4}>
            {profile.bio}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (!isTop) {
    // Non-top cards: no gesture handler, just static with stack offset
    return (
      <Animated.View
        style={[
          styles.card,
          cardAnimatedStyle,
          { top: stackOffset, zIndex: -index },
        ]}
        pointerEvents="none"
      >
        {cardContent}
      </Animated.View>
    );
  }

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        {cardContent}
      </Animated.View>
    </PanGestureHandler>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_HEIGHT = SCREEN_HEIGHT * 0.68;
const CARD_WIDTH = SCREEN_WIDTH - 32;

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
    overflow: 'hidden',
  },
  cardInner: {
    flex: 1,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 80,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Simulated gradient: transparent top, dark bottom
    backgroundColor: 'transparent',
    // We layer a semi-transparent black at the bottom via the infoPanel
  },
  actionOverlay: {
    position: 'absolute',
    top: 48,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 4,
  },
  likeOverlay: {
    left: 20,
    transform: [{ rotate: '-15deg' }],
    borderColor: '#10B981',
  },
  likeText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 2,
  },
  nopeOverlay: {
    right: 20,
    transform: [{ rotate: '15deg' }],
    borderColor: '#EF4444',
  },
  nopeText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 2,
  },
  superOverlay: {
    alignSelf: 'center',
    left: CARD_WIDTH / 2 - 70,
    top: 48,
    borderColor: '#3B82F6',
  },
  superText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#3B82F6',
    letterSpacing: 2,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  verifiedBadge: {
    fontSize: 18,
    color: '#4ECDC4',
    fontWeight: '700',
  },
  rateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B35',
    marginLeft: 8,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  star: {
    fontSize: 14,
  },
  ratingText: {
    fontSize: 12,
    color: '#D1D5DB',
    marginLeft: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#D1D5DB',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  bioText: {
    fontSize: 13,
    color: '#E5E7EB',
    marginTop: 4,
    lineHeight: 19,
  },
});

export default SwipeCard;
