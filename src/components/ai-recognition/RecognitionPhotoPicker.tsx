import { Image, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme';

type Props = {
  imageUri: string | null;
};

export default function RecognitionPhotoPicker({ imageUri }: Props) {
  return (
    <View style={styles.preview}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} />
      ) : (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="mushroom-outline" size={54} color={colors.accent} />
          <Text style={styles.emptyText}>Zrób zdjęcie grzyba</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { flex: 1, backgroundColor: colors.inset, overflow: 'hidden' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
});
