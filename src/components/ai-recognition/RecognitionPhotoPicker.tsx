import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  imageUri: string | null;
  sourceMode: 'camera' | 'gallery' | 'none';
  disabled: boolean;
  onCamera: () => void;
  onGallery: () => void;
};

export default function RecognitionPhotoPicker({ imageUri, sourceMode, disabled, onCamera, onGallery }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.preview}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} /> : <Text style={styles.placeholder}>{sourceMode === 'gallery' ? '🖼️' : '🍄'}</Text>}
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={onCamera} disabled={disabled}>
          <Text style={styles.primaryText}>Aparat</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onGallery} disabled={disabled}>
          <Text style={styles.secondaryText}>Galeria</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#102d24', borderRadius: 24, borderWidth: 1, borderColor: '#1e4338', padding: 16, marginBottom: 16 },
  preview: { height: 220, borderRadius: 18, backgroundColor: '#0c221b', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#254d3d', overflow: 'hidden' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholder: { fontSize: 76 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  primaryButton: { flex: 1, backgroundColor: '#2d8d62', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#f6fff9', fontWeight: '800' },
  secondaryButton: { flex: 1, backgroundColor: '#163b2f', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: '#edf8f1', fontWeight: '700' },
});
