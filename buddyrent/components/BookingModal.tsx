import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  Dimensions,
  FlatList,
} from 'react-native';
import { ActivityBadge } from '@/components/ActivityBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { ACTIVITIES } from '@/constants/activities';
import { formatCurrency, formatHours } from '@/lib/utils';
import type { Profile, Activity } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PLATFORM_FEE_RATE = 0.2; // 20%

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingInput {
  activityId: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  location: string;
  notes: string;
  hours: number;
  subtotal: number;
  platformFee: number;
  total: number;
}

interface BookingModalProps {
  visible: boolean;
  buddy: Profile;
  onClose: () => void;
  onConfirm: (booking: BookingInput) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateNextNDays(n: number): { label: string; value: string }[] {
  const days: { label: string; value: string }[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = d.toISOString().split('T')[0];
    const label =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Tomorrow'
          : `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
    days.push({ label, value });
  }
  return days;
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      const hh = h.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function calcHours(start: string, end: string): number {
  const diff = parseTimeToMinutes(end) - parseTimeToMinutes(start);
  return diff > 0 ? diff / 60 : 0;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

const DATES = generateNextNDays(30);
const TIME_SLOTS = generateTimeSlots();

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Price Row ────────────────────────────────────────────────────────────────

function PriceRow({
  label,
  value,
  isTotal,
}: {
  label: string;
  value: string;
  isTotal?: boolean;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, isTotal && styles.priceLabelTotal]}>
        {label}
      </Text>
      <Text style={[styles.priceValue, isTotal && styles.priceValueTotal]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingModal({
  visible,
  buddy,
  onClose,
  onConfirm,
}: BookingModalProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    DATES[0]?.value ?? '',
  );
  const [selectedStart, setSelectedStart] = useState<string>('10:00');
  const [selectedEnd, setSelectedEnd] = useState<string>('12:00');
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  // ── Slide animation ────────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // ── Price calculation ──────────────────────────────────────────────────────
  const hourlyRate = buddy.hourlyRate ?? 0;
  const hours = calcHours(selectedStart, selectedEnd);
  const subtotal = hourlyRate * hours;
  const platformFee = subtotal * PLATFORM_FEE_RATE;
  const total = subtotal + platformFee;

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<string, string>> = {};

    if (!selectedActivity) {
      newErrors.activity = 'Please select an activity';
    }
    if (!selectedDate) {
      newErrors.date = 'Please select a date';
    }
    if (hours <= 0) {
      newErrors.time = 'End time must be after start time';
    }
    if (!location.trim()) {
      newErrors.location = 'Please enter a meeting location';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedActivity, selectedDate, hours, location]);

  // ── Confirm ────────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!validate()) return;

    onConfirm({
      activityId: selectedActivity,
      date: selectedDate,
      startTime: selectedStart,
      endTime: selectedEnd,
      location: location.trim(),
      notes: notes.trim(),
      hours,
      subtotal,
      platformFee,
      total,
    });
  }, [
    validate,
    onConfirm,
    selectedActivity,
    selectedDate,
    selectedStart,
    selectedEnd,
    location,
    notes,
    hours,
    subtotal,
    platformFee,
    total,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
        />
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* Handle */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              <Avatar
                source={buddy.photos?.[0] ?? null}
                name={buddy.name}
                size="md"
                isOnline={buddy.isOnline}
              />
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>
                  Book {buddy.name}
                </Text>
                {buddy.hourlyRate != null && (
                  <Text style={styles.headerRate}>
                    {formatCurrency(buddy.hourlyRate)}/hr
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── Activity selector ────────────────────────────────────── */}
              <SectionHeader title="Choose Activity" />
              {errors.activity && (
                <Text style={styles.errorText}>{errors.activity}</Text>
              )}
              <FlatList
                data={ACTIVITIES}
                keyExtractor={(item) => item.id}
                numColumns={2}
                scrollEnabled={false}
                contentContainerStyle={styles.activitiesGrid}
                columnWrapperStyle={styles.activitiesRow}
                renderItem={({ item }: { item: Activity }) => {
                  const isSelected = selectedActivity === item.id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.activityItem,
                        isSelected && styles.activityItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedActivity(item.id);
                        setErrors((e) => ({ ...e, activity: undefined }));
                      }}
                      activeOpacity={0.7}
                    >
                      <ActivityBadge
                        activity={item}
                        size="sm"
                      />
                      {isSelected && (
                        <Text style={styles.activityCheckmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />

              {/* ── Date picker ──────────────────────────────────────────── */}
              <SectionHeader title="Select Date" />
              {errors.date && (
                <Text style={styles.errorText}>{errors.date}</Text>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateScrollContent}
              >
                {DATES.map((day) => {
                  const isSelected = selectedDate === day.value;
                  return (
                    <TouchableOpacity
                      key={day.value}
                      style={[
                        styles.dateChip,
                        isSelected && styles.dateChipSelected,
                      ]}
                      onPress={() => {
                        setSelectedDate(day.value);
                        setErrors((e) => ({ ...e, date: undefined }));
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dateChipText,
                          isSelected && styles.dateChipTextSelected,
                        ]}
                      >
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* ── Time picker ──────────────────────────────────────────── */}
              <SectionHeader title="Time" />
              {errors.time && (
                <Text style={styles.errorText}>{errors.time}</Text>
              )}
              <View style={styles.timeRow}>
                {/* Start time */}
                <View style={styles.timePickerBlock}>
                  <Text style={styles.timePickerLabel}>Start</Text>
                  <ScrollView
                    style={styles.timeScrollBox}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {TIME_SLOTS.map((slot) => {
                      const isSelected = selectedStart === slot;
                      return (
                        <TouchableOpacity
                          key={slot}
                          style={[
                            styles.timeSlot,
                            isSelected && styles.timeSlotSelected,
                          ]}
                          onPress={() => {
                            setSelectedStart(slot);
                            setErrors((e) => ({ ...e, time: undefined }));
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.timeSlotText,
                              isSelected && styles.timeSlotTextSelected,
                            ]}
                          >
                            {formatTime(slot)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Arrow */}
                <Text style={styles.timeArrow}>→</Text>

                {/* End time */}
                <View style={styles.timePickerBlock}>
                  <Text style={styles.timePickerLabel}>End</Text>
                  <ScrollView
                    style={styles.timeScrollBox}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {TIME_SLOTS.map((slot) => {
                      const isSelected = selectedEnd === slot;
                      return (
                        <TouchableOpacity
                          key={slot}
                          style={[
                            styles.timeSlot,
                            isSelected && styles.timeSlotSelected,
                          ]}
                          onPress={() => {
                            setSelectedEnd(slot);
                            setErrors((e) => ({ ...e, time: undefined }));
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.timeSlotText,
                              isSelected && styles.timeSlotTextSelected,
                            ]}
                          >
                            {formatTime(slot)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* Duration summary */}
              {hours > 0 && (
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>
                    Duration: {formatHours(hours)}
                  </Text>
                </View>
              )}

              {/* ── Location ────────────────────────────────────────────── */}
              <SectionHeader title="Meeting Location" />
              <Input
                placeholder="Coffee shop, park, address…"
                value={location}
                onChangeText={(v) => {
                  setLocation(v);
                  setErrors((e) => ({ ...e, location: undefined }));
                }}
                error={errors.location}
                leftIcon={<Text style={{ fontSize: 16 }}>📍</Text>}
                variant="outlined"
              />

              {/* ── Notes ───────────────────────────────────────────────── */}
              <SectionHeader title="Notes (optional)" />
              <View style={styles.notesContainer}>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Any special requests or details…"
                  placeholderTextColor="#9CA3AF"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* ── Price breakdown ─────────────────────────────────────── */}
              {hourlyRate > 0 && hours > 0 && (
                <>
                  <SectionHeader title="Price Breakdown" />
                  <View style={styles.priceCard}>
                    <PriceRow
                      label={`${formatCurrency(hourlyRate)}/hr × ${formatHours(hours)}`}
                      value={formatCurrency(subtotal)}
                    />
                    <View style={styles.priceDivider} />
                    <PriceRow
                      label="Platform fee (20%)"
                      value={formatCurrency(platformFee)}
                    />
                    <View style={styles.priceDividerThick} />
                    <PriceRow
                      label="Total"
                      value={formatCurrency(total)}
                      isTotal
                    />
                  </View>
                </>
              )}

              {/* Bottom spacing for button */}
              <View style={{ height: 100 }} />
            </ScrollView>

            {/* ── CTA ──────────────────────────────────────────────────── */}
            <View style={styles.ctaContainer}>
              <Button
                onPress={handleConfirm}
                variant="primary"
                size="lg"
                className="w-full"
              >
                {`Book Now${total > 0 ? ` · ${formatCurrency(total)}` : ''}`}
              </Button>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.92,
    minHeight: SCREEN_HEIGHT * 0.6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  headerRate: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 20,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 6,
    fontWeight: '500',
  },

  // Activities grid
  activitiesGrid: {
    gap: 8,
  },
  activitiesRow: {
    gap: 8,
  },
  activityItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    minHeight: 44,
  },
  activityItemSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF3EE',
  },
  activityCheckmark: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '700',
  },

  // Date chips
  dateScrollContent: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 4,
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dateChipSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    whiteSpace: 'nowrap',
  } as any,
  dateChipTextSelected: {
    color: '#FFFFFF',
  },

  // Time picker
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timePickerBlock: {
    flex: 1,
  },
  timePickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
    textAlign: 'center',
  },
  timeScrollBox: {
    height: 160,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
  },
  timeArrow: {
    fontSize: 20,
    color: '#6B7280',
    marginTop: 36,
  },
  timeSlot: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: '#FF6B35',
  },
  timeSlotText: {
    fontSize: 13,
    color: '#1A1A2E',
    fontWeight: '500',
  },
  timeSlotTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  durationBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: '#4ECDC41A',
  },
  durationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4ECDC4',
  },

  // Notes
  notesContainer: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    padding: 12,
    minHeight: 80,
  },
  notesInput: {
    fontSize: 14,
    color: '#1A1A2E',
    lineHeight: 20,
    minHeight: 56,
  },

  // Price
  priceCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceLabelTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  priceValue: {
    fontSize: 14,
    color: '#1A1A2E',
    fontWeight: '500',
  },
  priceValueTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF6B35',
  },
  priceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
  },
  priceDividerThick: {
    height: 1,
    backgroundColor: '#D1D5DB',
  },

  // CTA
  ctaContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
});

export default BookingModal;
