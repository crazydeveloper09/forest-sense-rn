import { ScrollView, StyleSheet, Text } from 'react-native';
import RecognitionAlternatives from '../components/ai-recognition/RecognitionAlternatives';
import RecognitionPhotoPicker from '../components/ai-recognition/RecognitionPhotoPicker';
import RecognitionQuotaPanel from '../components/ai-recognition/RecognitionQuotaPanel';
import RecognitionResultCard from '../components/ai-recognition/RecognitionResultCard';
import RecognitionSafetyNotice from '../components/ai-recognition/RecognitionSafetyNotice';
import { useAIRecognition } from './ai-recognition/useAIRecognition';

type Props = { adsEnabled: boolean; isPremium: boolean };

export default function AIRecognitionScreen({ adsEnabled, isPremium }: Props) {
  const { state, actions } = useAIRecognition(adsEnabled, isPremium);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Rozpoznanie AI</Text>
      <RecognitionQuotaPanel
        usage={state.usage}
        loading={state.usageLoading}
        adLoading={state.adLoading}
        adsEnabled={adsEnabled}
        onWatchAd={actions.watchRewardedAd}
      />
      <RecognitionPhotoPicker
        imageUri={state.imageUri}
        sourceMode={state.sourceMode}
        disabled={state.isAnalyzing || state.usageLoading || Boolean(state.usage && !state.usage.canRecognize)}
        onCamera={actions.openCamera}
        onGallery={actions.openGallery}
      />
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
      <RecognitionSafetyNotice />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#081a14' },
  content: { padding: 20, paddingTop: 30, paddingBottom: 28 },
  title: { color: '#edf9f1', fontSize: 28, fontWeight: '800', marginBottom: 18 },
});
