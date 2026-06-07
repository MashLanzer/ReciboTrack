import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/constants/colors';
import {
  ACTIVITIES,
  ACTIVITY_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_EMOJIS,
} from '@/constants/activities';
import type { ActivityCategory } from '@/types';

const MIN_REQUIRED = 3;

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.progressContainer}>
      <Text style={styles.progressLabel}>Step {step} of {total}</Text>
      <View style={styles.progressTrack}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              i < step ? styles.progressActive : styles.progressInactive,
              i > 0 && { marginLeft: 6 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export default function OnboardingStep3() {
  const router = useRouter();
  const { updateProfile, isLoading, profile } = useAuthStore();

  const isBuddy = profile?.role === 'buddy' || profile?.role === 'both';

  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const displayedActivities = selectedCategory === 'all'
    ? ACTIVITIES
    : ACTIVITIES.filter(a => a.category === selectedCategory);

  const toggleActivity = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    if (selected.size < MIN_REQUIRED) {
      Alert.alert(
        'Select more activities',
        `Please select at least ${MIN_REQUIRED} activities to continue.`,
      );
      return;
    }
    try {
      await updateProfile({ activities: Array.from(selected) });
      router.push('/(auth)/onboarding/step4');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save activities');
    }
  };

  const allCategoryTabs: Array<ActivityCategory | 'all'> = ['all', ...ACTIVITY_CATEGORIES];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <ProgressBar step={3} total={4} />

        <Text style={styles.title}>What activities are you into?</Text>
        <Text style={styles.subtitle}>
          {isBuddy
            ? 'Show seekers what experiences you can offer'
            : 'Find buddies who share your interests'}
        </Text>

        {/* Category Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {allCategoryTabs.map(cat => {
            const isActive = selectedCategory === cat;
            const label = cat === 'all' ? 'All' : CATEGORY_LABELS[cat];
            const emoji = cat === 'all' ? '✨' : CATEGORY_EMOJIS[cat];
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.75}
              >
                <Text style={styles.tabEmoji}>{emoji}</Text>
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Activity Grid */}
        <View style={styles.grid}>
          {displayedActivities.map(activity => {
            const isSelected = selected.has(activity.id);
            return (
              <TouchableOpacity
                key={activity.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleActivity(activity.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.chipEmoji}>{activity.emoji}</Text>
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {activity.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Counter + Continue */}
        <View style={styles.footer}>
          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {selected.size} selected
            </Text>
            {selected.size < MIN_REQUIRED && (
              <Text style={styles.countHint}>
                Select {MIN_REQUIRED - selected.size} more
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (selected.size < MIN_REQUIRED || isLoading) && styles.primaryBtnDisabled,
            ]}
            activeOpacity={0.85}
            onPress={handleContinue}
            disabled={selected.size < MIN_REQUIRED || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Continue →</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scroll: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 32,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginHorizontal: 28,
  },
  backIcon: {
    fontSize: 20,
    color: Colors.textPrimary,
  },
  progressContainer: {
    marginBottom: 28,
    paddingHorizontal: 28,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  progressTrack: {
    flexDirection: 'row',
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  progressActive: {
    backgroundColor: Colors.primary.DEFAULT,
  },
  progressInactive: {
    backgroundColor: Colors.gray[200],
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
    paddingHorizontal: 28,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 28,
  },
  tabsScroll: {
    marginBottom: 20,
  },
  tabsContent: {
    paddingHorizontal: 28,
    gap: 8,
    paddingBottom: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
  },
  tabActive: {
    backgroundColor: Colors.primary[50],
    borderColor: Colors.primary.DEFAULT,
  },
  tabEmoji: {
    fontSize: 14,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary[700],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 28,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  chipSelected: {
    backgroundColor: Colors.primary.DEFAULT,
    borderColor: Colors.primary.DEFAULT,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 28,
    gap: 14,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  countHint: {
    fontSize: 13,
    color: Colors.warning,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: Colors.primary.DEFAULT,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: Colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
