import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import RecognitionAlternatives from '../components/ai-recognition/RecognitionAlternatives';
import RecognitionPhotoPicker from '../components/ai-recognition/RecognitionPhotoPicker';
import RecognitionQuiz from '../components/ai-recognition/RecognitionQuiz';
import RecognitionQuotaPanel from '../components/ai-recognition/RecognitionQuotaPanel';
import RecognitionResultCard from '../components/ai-recognition/RecognitionResultCard';
import RecognitionSafetyNotice from '../components/ai-recognition/RecognitionSafetyNotice';
import { colors } from '../theme';
import { useAIRecognition } from './ai-recognition/useAIRecognition';

type Props = { adsEnabled: boolean; isPremium: boolean };

const COMPACT_PHOTO = 220;

export default function AIRecognitionScreen({ adsEnabled, isPremium }: Props) {
  const { state, actions } = useAIRecognition(adsEnabled, isPremium);
  const hasPhoto = Boolean(state.imageUri);
  const showQuiz = state.quizStep != null;
  const showResult = !showQuiz && Boolean(state.result || state.isAnalyzing || state.analysisError);
  const showSheet = showQuiz || showResult;
  const [expandedPhoto, setExpandedPhoto] = useState(0);
  const photoHeight = useRef(new Animated.Value(0)).current;
  const resultProgress = useRef(new Animated.Value(0)).current;
  const actionsLocked = state.isAnalyzing || state.usageLoading || Boolean(state.usage && !state.usage.canRecognize);

  useEffect(() => {
    if (!expandedPhoto) return;
    Animated.timing(photoHeight, {
      toValue: hasPhoto ? COMPACT_PHOTO : expandedPhoto,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expandedPhoto, hasPhoto, photoHeight]);

  useEffect(() => {
    Animated.timing(resultProgress, {
      toValue: showSheet ? 1 : 0,
      duration: 380,
      delay: showSheet ? 120 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [resultProgress, showSheet]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <RecognitionQuotaPanel
          usage={state.usage}
          loading={state.usageLoading}
          adLoading={state.adLoading}
          adsEnabled={adsEnabled}
          onWatchAd={actions.watchRewardedAd}
        />
        <Pressable style={styles.cameraLink} onPress={actions.openCamera} disabled={actionsLocked} accessibilityRole="button">
          <MaterialCommunityIcons name="camera-outline" size={18} color={colors.text} />
          <Text style={styles.cameraLinkText}>Aparat</Text>
        </Pressable>
      </View>
      <View
        style={styles.stage}
        onLayout={(event) => {
          if (expandedPhoto || hasPhoto) return;
          const next = event.nativeEvent.layout.height;
          if (next > 0) {
            photoHeight.setValue(next);
            setExpandedPhoto(next);
          }
        }}
      >
        <Animated.View style={[styles.hero, expandedPhoto ? { height: photoHeight } : styles.heroFlex]}>
          <RecognitionPhotoPicker imageUri={state.imageUri} />
        </Animated.View>
        <Animated.View
          pointerEvents={showSheet ? 'auto' : 'none'}
          style={[
            showSheet ? styles.result : styles.resultHidden,
            {
              opacity: resultProgress,
              transform: [{
                translateY: resultProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [28, 0],
                }),
              }],
            },
          ]}
        >
          <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent} keyboardShouldPersistTaps="handled">
            {showQuiz && state.quizStep != null ? (
              <RecognitionQuiz step={state.quizStep} onAnswer={actions.answerQuiz} onCancel={actions.cancelQuiz} />
            ) : null}
            <RecognitionResultCard
              result={state.result}
              isAnalyzing={state.isAnalyzing}
              error={state.analysisError}
              sourceMode={state.sourceMode}
              locationLabel={state.locationLabel}
              saved={state.saved}
              isPremium={isPremium}
              onSave={actions.saveCurrentObservation}
            />
            <RecognitionAlternatives candidates={state.result?.alternatives ?? []} />
            {showResult ? dockNode() : null}
          </ScrollView>
        </Animated.View>
      </View>
      {showSheet ? null : dockNode()}
    </View>
  );

  function dockNode() {
    return (
      <View style={[styles.dock, showResult && styles.dockInResult]}>
        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={actions.openCamera} disabled={actionsLocked}>
            <MaterialCommunityIcons name="camera-outline" size={18} color={colors.buttonText} />
            <Text style={styles.primaryText}>Zrób zdjęcie</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={actions.openGallery} disabled={actionsLocked}>
            <MaterialCommunityIcons name="image-outline" size={18} color={colors.text} />
            <Text style={styles.secondaryText}>Galeria</Text>
          </Pressable>
        </View>
        <RecognitionSafetyNotice />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  cameraLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cameraLinkText: { color: colors.text, fontWeight: '700' },
  stage: { flex: 1, minHeight: 0, overflow: 'hidden' },
  hero: { overflow: 'hidden' },
  heroFlex: { flex: 1 },
  result: { flex: 1, minHeight: 0 },
  resultHidden: { height: 0, overflow: 'hidden' },
  resultScroll: { flex: 1 },
  resultContent: { gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  dock: { flexShrink: 0, gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, backgroundColor: colors.background },
  dockInResult: { paddingHorizontal: 0, paddingBottom: 4 },
  actions: { flexDirection: 'row', gap: 10 },
  primaryButton: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.button, borderRadius: 12, paddingVertical: 13 },
  primaryText: { color: colors.buttonText, fontWeight: '800' },
  secondaryButton: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  secondaryText: { color: colors.text, fontWeight: '700' },
});
