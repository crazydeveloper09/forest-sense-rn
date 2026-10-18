import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { postJson } from '../api/http';

const TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
let lastToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type;
    const remote = type === 'trust-request' || type === 'trust-accepted';
    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: remote,
      shouldSetBadge: false,
    };
  },
});

function projectId(): string | null {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

async function readToken(): Promise<string | null> {
  const id = projectId();
  if (!id) return lastToken;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return lastToken;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  if (!TOKEN_PATTERN.test(token)) return lastToken;
  lastToken = token;
  return token;
}

export async function registerRemotePush(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trusted', {
      name: 'Zaufani użytkownicy',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;
  const token = await readToken();
  if (!token) return;
  await postJson('/push/register', { token }, true);
}

export async function unregisterRemotePush(): Promise<void> {
  const token = await readToken().catch(() => lastToken);
  lastToken = null;
  if (!token) return;
  try {
    await postJson('/push/unregister', { token }, true);
  } catch {
    // Wylogowanie i tak usuwa sesję, gdy serwer nie odbierze tokenu.
  }
}
