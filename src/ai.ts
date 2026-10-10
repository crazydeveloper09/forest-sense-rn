import { BillingApiError, getInstallationId, type UsageStatus } from './billing';

export type MushroomCandidate = {
  name: string;
  confidence: number;
};

export type MushroomIdentification = {
  identified: boolean;
  name: string;
  confidence: number;
  description: string;
  habitat: string;
  alternatives: MushroomCandidate[];
};

export type IdentificationResponse = {
  identification: MushroomIdentification;
  usage: UsageStatus;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_AI_API_URL?.replace(/\/$/, '');

export async function identifyMushroomImage(
  base64: string,
  mimeType: string,
): Promise<IdentificationResponse> {
  if (!API_BASE_URL) {
    throw new Error('Brak adresu API. Ustaw EXPO_PUBLIC_AI_API_URL w pliku .env i uruchom ponownie Expo.');
  }

  const installationId = await getInstallationId();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mimeType, installationId }),
    });
  } catch {
    throw new Error(
      `Nie można połączyć się z API AI (${API_BASE_URL}). Sprawdź, czy serwer działa, telefon jest w tej samej sieci Wi-Fi i zapora systemu pozwala na połączenie.`,
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;

  if (!response.ok) {
      throw new BillingApiError(
      typeof data?.error === 'string' ? data.error : 'Nie udało się rozpoznać zdjęcia. Spróbuj ponownie.',
      typeof data?.code === 'string' ? data.code : undefined,
      data?.usage as UsageStatus | undefined,
      );
  }

  const identification = data?.identification as MushroomIdentification | undefined;
  const usage = data?.usage as UsageStatus | undefined;
  if (
    !identification ||
    typeof identification.name !== 'string' ||
    !usage ||
    !Array.isArray(identification.alternatives)
  ) {
    throw new Error('Serwer zwrócił nieprawidłowy wynik rozpoznawania.');
  }

  return {
    identification: {
      identified: identification.identified === true,
      name: identification.name,
      confidence: Math.max(0, Math.min(100, Math.round(identification.confidence))),
      description: String(identification.description ?? ''),
      habitat: String(identification.habitat ?? ''),
      alternatives: identification.alternatives.map((item) => ({
            name: String(item.name),
            confidence: Math.max(0, Math.min(100, Math.round(item.confidence))),
          })),
    },
    usage,
  };
}
