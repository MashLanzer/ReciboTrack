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
import type { UserRole } from '@/types';

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

const ROLES: { id: UserRole; emoji: string; title: string; description: string }[] = [
  {
    id: 'seeker',
    emoji: '🔍',
    title: "I'm a Seeker",
    description: 'I want to hire buddies for activities',
  },
  {
    id: 'buddy',
    emoji: '🌟',
    title: "I'm a Buddy",
    description: 'I want to earn money as a companion',
  },
  {
    id: 'both',
    emoji: '✨',
    title: "I'm Both",
    description: 'I want to do both!',
  },
];

const MIN_RATE = 15;
const MAX_RATE = 100;
const HOURS_PER_WEEK = 10;

function formatCents(dollars: number): string {
  return `$${dollars}`;
}

export default function OnboardingStep2() {
  const router = useRouter();
  const { updateProfile, isLoading } = useAuthStore();

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [hourlyRate, setHourlyRate] = useState(30);

  const isBuddy = selectedRole === 'buddy' || selectedRole === 'both';
  const weeklyEstimate = hourlyRate * HOURS_PER_WEEK;

  const handleRateSlider = (direction: 'up' | 'down') => {
    setHourlyRate(prev => {
      if (direction === 'up') return Math.min(MAX_RATE, prev + 5);
      return Math.max(MIN_RATE, prev - 5);
    });
  };

  const handleContinue = async () => {
    if (!selectedRole) {
      Alert.alert('Select a role', 'Please choose how you want to use BuddyRent.');
      return;
    }
    try {
      await updateProfile({
        role: selectedRole,
        hourlyRate: isBuddy ? hourlyRate * 100 : 0, // store in cents
      });
      router.push('/(auth)/onboarding/step3');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save your role');
    }
  };

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

        <ProgressBar step={2} total={4} />

        <Text style={styles.title}>What describes you best?</Text>
        <Text style={styles.subtitle}>You can change this anytime in your profile settings</Text>

        {/* Role Cards */}
        <View style={styles.cardsContainer}>
          {ROLES.map(role => {
            const selected = selectedRole === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                style={[styles.roleCard, selected && styles.roleCardSelected]}
                activeOpacity={0.8}
                onPress={() => setSelectedRole(role.id)}
              >
                <View style={styles.roleCardLeft}>
                  <View style={[styles.roleEmojiBg, selected && styles.roleEmojiBgSelected]}>
                    <Text style={styles.roleEmoji}>{role.emoji}</Text>
                  </View>
                  <View style={styles.roleTextWrap}>
                    <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>
                      {role.title}
                    </Text>
                    <Text style={[styles.roleDesc, selected && styles.roleDescSelected]}>
                      {role.description}
                    </Text>
                  </View>
                </View>
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Rate Slider (shown when buddy role selected) */}
        {isBuddy && (
          <View style={styles.rateCard}>
            <Text style={styles.rateCardTitle}>Set your hourly rate</Text>
            <Text style={styles.rateCardSubtitle}>
              The average buddy earns ${MIN_RATE}–${MAX_RATE}/hr
            </Text>

            <View style={styles.rateDisplay}>
              <Text style={styles.rateDollar}>{formatCents(hourlyRate)}</Text>
              <Text style={styles.ratePerHr}>/hr</Text>
            </View>

            {/* Simple step slider */}
            <View style={styles.sliderRow}>
              <TouchableOpacity
                style={styles.sliderBtn}
                onPress={() => handleRateSlider('down')}
                disabled={hourlyRate <= MIN_RATE}
              >
                <Text style={[styles.sliderBtnText, hourlyRate <= MIN_RATE && styles.sliderBtnDisabled]}>
                  −
                </Text>
              </TouchableOpacity>

              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    {
                      width: `${((hourlyRate - MIN_RATE) / (MAX_RATE - MIN_RATE)) * 100}%`,
                    },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={styles.sliderBtn}
                onPress={() => handleRateSlider('up')}
                disabled={hourlyRate >= MAX_RATE}
              >
                <Text style={[styles.sliderBtnText, hourlyRate >= MAX_RATE && styles.sliderBtnDisabled]}>
                  +
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.estimateRow}>
              <Text style={styles.estimateLabel}>Estimated weekly earnings</Text>
              <Text style={styles.estimateValue}>${weeklyEstimate}/wk</Text>
            </View>
          </View>
        )}

        {/* Continue */}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            (!selectedRole || isLoading) && styles.primaryBtnDisabled,
          ]}
          activeOpacity={0.85}
          onPress={handleContinue}
          disabled={!selectedRole || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Continue →</Text>
          )}
        </TouchableOpacity>
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
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 48,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  backIcon: {
    fontSize: 20,
    color: Colors.textPrimary,
  },
  progressContainer: {
    marginBottom: 32,
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
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 28,
    lineHeight: 22,
  },
  cardsContainer: {
    gap: 14,
    marginBottom: 24,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  roleCardSelected: {
    borderColor: Colors.primary.DEFAULT,
    backgroundColor: Colors.primary[50],
  },
  roleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  roleEmojiBg: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleEmojiBgSelected: {
    backgroundColor: Colors.primary[100],
  },
  roleEmoji: {
    fontSize: 24,
  },
  roleTextWrap: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  roleTitleSelected: {
    color: Colors.primary[700],
  },
  roleDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  roleDescSelected: {
    color: Colors.primary[600],
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.gray[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioOuterSelected: {
    borderColor: Colors.primary.DEFAULT,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.primary.DEFAULT,
  },
  rateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: Colors.secondary.DEFAULT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  rateCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  rateCardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  rateDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 20,
  },
  rateDollar: {
    fontSize: 52,
    fontWeight: '800',
    color: Colors.primary.DEFAULT,
    letterSpacing: -2,
  },
  ratePerHr: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sliderBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary.DEFAULT,
  },
  sliderBtnDisabled: {
    color: Colors.gray[300],
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.gray[100],
    borderRadius: 4,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.primary.DEFAULT,
    borderRadius: 4,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.secondary[50],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  estimateLabel: {
    fontSize: 13,
    color: Colors.secondary[700],
    fontWeight: '500',
  },
  estimateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondary[600],
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
