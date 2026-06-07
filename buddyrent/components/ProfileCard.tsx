import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { formatRelativeTime } from '@/lib/utils';
import type { Profile } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DELETE_BUTTON_WIDTH = 72;
const SWIPE_THRESHOLD = -DELETE_BUTTON_WIDTH;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileCardProps {
  profile: Profile;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  hasMessages?: boolean;
  onPress?: (profile: Profile) => void;
  onDelete?: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileCard({
  profile,
  lastMessage,
  lastMessageTime,
  unreadCount = 0,
  hasMessages = false,
  onPress,
  onDelete,
}: ProfileCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  // ── Swipe handling ────────────────────────────────────────────────────────

  const panResponder = useRef(
    require('react-native').PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (!onDelete) return;
        const newX = isOpen.current
          ? Math.min(0, SWIPE_THRESHOLD + gestureState.dx)
          : Math.min(0, gestureState.dx);
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (!onDelete) return;
        if (gestureState.dx < SWIPE_THRESHOLD / 2) {
          // Open the delete button
          Animated.spring(translateX, {
            toValue: SWIPE_THRESHOLD,
            useNativeDriver: true,
            tension: 60,
            friction: 10,
          }).start();
          isOpen.current = true;
        } else {
          // Snap closed
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 60,
            friction: 10,
          }).start();
          isOpen.current = false;
        }
      },
    }),
  ).current;

  const handleClose = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
    isOpen.current = false;
  }, [translateX]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      Animated.timing(translateX, {
        toValue: -SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start(() => onDelete(profile.id));
    }
  }, [onDelete, profile.id, translateX]);

  const handlePress = useCallback(() => {
    if (isOpen.current) {
      handleClose();
      return;
    }
    if (onPress) onPress(profile);
  }, [handleClose, onPress, profile]);

  // ── Display values ────────────────────────────────────────────────────────

  const displayMessage = hasMessages
    ? lastMessage ?? ''
    : `Say hi to ${profile.name}! 👋`;

  const timeDisplay =
    lastMessageTime ? formatRelativeTime(lastMessageTime) : '';

  const hasUnread = unreadCount > 0;

  return (
    <View style={styles.outerContainer}>
      {/* Delete action (revealed on swipe) */}
      {onDelete && (
        <View style={styles.deleteButtonContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
            <Text style={styles.deleteLabel}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main card row (swipeable) */}
      <Animated.View
        style={[styles.cardRow, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.cardInner}
          onPress={handlePress}
          activeOpacity={0.85}
        >
          {/* Avatar with online indicator */}
          <View style={styles.avatarWrapper}>
            <Avatar
              source={profile.photos?.[0] ?? null}
              name={profile.name}
              size="lg"
              isOnline={profile.isOnline}
            />
          </View>

          {/* Text content */}
          <View style={styles.textBlock}>
            <View style={styles.topRow}>
              <Text
                style={[styles.nameText, hasUnread && styles.nameTextBold]}
                numberOfLines={1}
              >
                {profile.name}
              </Text>
              <Text style={styles.timeText}>{timeDisplay}</Text>
            </View>

            <View style={styles.bottomRow}>
              <Text
                style={[
                  styles.messageText,
                  !hasMessages && styles.messageTextMuted,
                  hasUnread && styles.messageTextBold,
                ]}
                numberOfLines={1}
              >
                {displayMessage}
              </Text>

              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
    backgroundColor: '#FAFAFA',
    marginHorizontal: 0,
    overflow: 'hidden',
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BUTTON_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: DELETE_BUTTON_WIDTH,
    height: '100%',
    gap: 4,
  },
  deleteIcon: {
    fontSize: 20,
  },
  deleteLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardRow: {
    backgroundColor: '#FFFFFF',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  avatarWrapper: {
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A2E',
    flex: 1,
    marginRight: 8,
  },
  nameTextBold: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
    flexShrink: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    marginRight: 8,
  },
  messageTextMuted: {
    color: '#FF6B35',
    fontStyle: 'italic',
  },
  messageTextBold: {
    color: '#1A1A2E',
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ProfileCard;
