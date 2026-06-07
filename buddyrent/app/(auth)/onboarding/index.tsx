import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/constants/colors';

const MAX_BIO = 150;

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

export default function OnboardingStep1() {
  const router = useRouter();
  const { uploadPhoto, updateProfile, isLoading } = useAuthStore();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const showPhotoPicker = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Photo Library', onPress: pickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleContinue = async () => {
    try {
      setUploading(true);
      if (photoUri) {
        await uploadPhoto(photoUri, 0);
      }
      await updateProfile({ bio: bio.trim(), location: location.trim() });
      router.push('/(auth)/onboarding/step2');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save profile');
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = () => {
    router.push('/(auth)/onboarding/step2');
  };

  const busy = isLoading || uploading;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ProgressBar step={1} total={4} />

        <Text style={styles.title}>Let's set up your profile</Text>
        <Text style={styles.subtitle}>Help others get to know you before meeting up</Text>

        {/* Photo Upload */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoCircle} onPress={showPhotoPicker} activeOpacity={0.8}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderIcon}>📷</Text>
                <Text style={styles.photoPlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
          {photoUri && (
            <TouchableOpacity onPress={showPhotoPicker} style={styles.changePhotoBtn}>
              <Text style={styles.changePhotoText}>Change photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bio */}
        <View style={styles.fieldWrap}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Short Bio</Text>
            <Text style={[styles.charCount, bio.length > MAX_BIO - 20 ? styles.charCountWarn : null]}>
              {bio.length}/{MAX_BIO}
            </Text>
          </View>
          <TextInput
            style={[styles.textArea, bio.length > MAX_BIO ? styles.inputError : null]}
            placeholder="Tell potential buddies a little about yourself — your vibe, what you love doing, fun facts..."
            placeholderTextColor={Colors.textDisabled}
            multiline
            numberOfLines={4}
            maxLength={MAX_BIO}
            value={bio}
            onChangeText={setBio}
            textAlignVertical="top"
          />
        </View>

        {/* Location */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Austin, TX"
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Continue */}
        <TouchableOpacity
          style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleContinue}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Continue →</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip for now</Text>
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
    paddingBottom: 40,
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
    marginBottom: 32,
    lineHeight: 22,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  photoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: Colors.gray[100],
    borderWidth: 3,
    borderColor: Colors.primary.DEFAULT,
    borderStyle: 'dashed',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoPlaceholderIcon: {
    fontSize: 28,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  changePhotoBtn: {
    marginTop: 12,
  },
  changePhotoText: {
    fontSize: 14,
    color: Colors.primary.DEFAULT,
    fontWeight: '600',
  },
  fieldWrap: {
    marginBottom: 22,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 7,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  charCountWarn: {
    color: Colors.warning,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 110,
  },
  inputError: {
    borderColor: Colors.error,
  },
  primaryBtn: {
    backgroundColor: Colors.primary.DEFAULT,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDisabled: {
    opacity: 0.65,
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
  },
  skipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
