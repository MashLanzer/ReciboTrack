import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/constants/colors';

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

const WHY_ITEMS = [
  { icon: '🔒', text: 'All data is encrypted and never shared with third parties' },
  { icon: '🛡️', text: 'Verification helps keep the community safe for everyone' },
  { icon: '✅', text: 'Verified users get a badge that builds trust with buddies' },
];

export default function OnboardingStep4() {
  const router = useRouter();
  const { submitVerification, isLoading } = useAuthStore();

  const [idPhotoUri, setIdPhotoUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickIdPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setIdPhotoUri(result.assets[0].uri);
    }
  };

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) {
      setSelfieUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!idPhotoUri || !selfieUri) {
      Alert.alert('Missing documents', 'Please upload both your ID photo and a selfie.');
      return;
    }
    try {
      setSubmitting(true);
      await submitVerification(idPhotoUri, selfieUri);
      Alert.alert(
        'Submitted! 🎉',
        'Your identity verification is under review. This usually takes 1–2 hours.',
        [{ text: 'Start Exploring', onPress: () => router.replace('/(tabs)/discover') }],
      );
    } catch (e: any) {
      Alert.alert('Submission Failed', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Verification?',
      'Without verification you won\'t be able to book or accept buddies. You can verify later in your profile.',
      [
        { text: 'Verify Now', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: () => router.replace('/(tabs)/discover'),
        },
      ],
    );
  };

  const busy = isLoading || submitting;

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

        <ProgressBar step={4} total={4} />

        <Text style={styles.title}>Verify your identity</Text>
        <Text style={styles.subtitle}>
          BuddyRent requires ID verification for the safety of our community
        </Text>

        {/* ID Card Upload */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>Government-issued ID (front)</Text>
        </View>
        <TouchableOpacity
          style={[styles.uploadCard, idPhotoUri && styles.uploadCardDone]}
          activeOpacity={0.8}
          onPress={pickIdPhoto}
        >
          {idPhotoUri ? (
            <View style={styles.uploadDoneRow}>
              <Image source={{ uri: idPhotoUri }} style={styles.uploadThumb} />
              <View style={styles.uploadDoneInfo}>
                <Text style={styles.uploadDoneTitle}>ID uploaded ✓</Text>
                <Text style={styles.uploadDoneHint}>Tap to change</Text>
              </View>
            </View>
          ) : (
            <View style={styles.uploadEmpty}>
              <Text style={styles.uploadIcon}>🪪</Text>
              <Text style={styles.uploadTitle}>Upload ID Photo</Text>
              <Text style={styles.uploadHint}>
                Driver's license, passport, or state ID
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Selfie */}
        <View style={[styles.sectionLabel, { marginTop: 20 }]}>
          <Text style={styles.sectionLabelText}>Selfie</Text>
        </View>
        <TouchableOpacity
          style={[styles.uploadCard, selfieUri && styles.uploadCardDone]}
          activeOpacity={0.8}
          onPress={takeSelfie}
        >
          {selfieUri ? (
            <View style={styles.uploadDoneRow}>
              <Image source={{ uri: selfieUri }} style={[styles.uploadThumb, styles.selfieThumb]} />
              <View style={styles.uploadDoneInfo}>
                <Text style={styles.uploadDoneTitle}>Selfie taken ✓</Text>
                <Text style={styles.uploadDoneHint}>Tap to retake</Text>
              </View>
            </View>
          ) : (
            <View style={styles.uploadEmpty}>
              <Text style={styles.uploadIcon}>🤳</Text>
              <Text style={styles.uploadTitle}>Take a Selfie</Text>
              <Text style={styles.uploadHint}>
                Look straight at the camera, no filters
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Why We Verify (collapsible) */}
        <TouchableOpacity
          style={styles.whyHeader}
          onPress={() => setWhyOpen(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.whyHeaderText}>Why do we verify? {whyOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {whyOpen && (
          <View style={styles.whyBody}>
            {WHY_ITEMS.map((item, i) => (
              <View key={i} style={styles.whyItem}>
                <Text style={styles.whyItemIcon}>{item.icon}</Text>
                <Text style={styles.whyItemText}>{item.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            (busy || !idPhotoUri || !selfieUri) && styles.primaryBtnDisabled,
          ]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={busy || !idPhotoUri || !selfieUri}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Submit for Review</Text>
          )}
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
        <Text style={styles.skipWarning}>
          ⚠️ You won't be able to make or accept bookings without verification
        </Text>
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
  sectionLabel: {
    marginBottom: 10,
  },
  sectionLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  uploadCardDone: {
    borderStyle: 'solid',
    borderColor: Colors.success,
    backgroundColor: '#F0FDF4',
    padding: 16,
    alignItems: 'flex-start',
  },
  uploadEmpty: {
    alignItems: 'center',
    gap: 8,
  },
  uploadIcon: {
    fontSize: 36,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  uploadHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  uploadDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  uploadThumb: {
    width: 64,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.gray[200],
  },
  selfieThumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  uploadDoneInfo: {
    flex: 1,
  },
  uploadDoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: 2,
  },
  uploadDoneHint: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  whyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 20,
  },
  whyHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary.DEFAULT,
  },
  whyBody: {
    backgroundColor: Colors.secondary[50],
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  whyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  whyItemIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  whyItemText: {
    fontSize: 13,
    color: Colors.secondary[700],
    lineHeight: 19,
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: Colors.primary.DEFAULT,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
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
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 6,
  },
  skipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  skipWarning: {
    fontSize: 12,
    color: Colors.warning,
    textAlign: 'center',
    lineHeight: 18,
  },
});
