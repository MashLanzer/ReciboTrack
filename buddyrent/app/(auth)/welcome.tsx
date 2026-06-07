import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

const FEATURES = [
  { icon: '🤝', text: 'Hire a buddy by the hour' },
  { icon: '✅', text: 'Verified identities only' },
  { icon: '💰', text: 'Safe, transparent payments' },
];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#FF6B35', '#FF9E6E', '#4ECDC4']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoWrap}>
              <View style={[styles.circle, styles.circleLeft]} />
              <View style={[styles.circle, styles.circleRight]} />
            </View>
          </View>

          {/* App Name */}
          <Text style={styles.appName}>BuddyRent</Text>
          <Text style={styles.tagline}>
            Real plans. Real connections.{'\n'}100% platonic.
          </Text>

          {/* Feature Bullets */}
          <View style={styles.featuresContainer}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* CTA Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.getStartedBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.signInLink}>
                Already have an account?{' '}
                <Text style={styles.signInLinkBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            BuddyRent is a strictly platonic companionship platform.
            Any romantic or sexual activity is prohibited and will result
            in immediate account termination.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 32,
  },
  logoContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  logoWrap: {
    width: 120,
    height: 80,
    position: 'relative',
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    position: 'absolute',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  circleLeft: {
    left: 0,
    top: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  circleRight: {
    right: 0,
    top: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 12,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 48,
    fontWeight: '400',
  },
  featuresContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 56,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  featureIcon: {
    fontSize: 24,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
  buttonsContainer: {
    width: '100%',
    gap: 20,
    alignItems: 'center',
    marginBottom: 32,
  },
  getStartedBtn: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  getStartedText: {
    color: '#FF6B35',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  signInLink: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    textAlign: 'center',
  },
  signInLinkBold: {
    color: '#FFFFFF',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  disclaimer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
});
