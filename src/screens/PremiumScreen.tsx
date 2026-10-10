import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../auth/AuthContext';
import { createBillingPortal, createPremiumCheckout, getUsage, subscribeUsage, type UsageStatus } from '../billing';
import PremiumOffer from '../components/premium/PremiumOffer';
import PremiumPlans from '../components/premium/PremiumPlans';

export default function PremiumScreen() {
  const { user, openAuth } = useAuth();
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getUsage().then((status) => {
      if (isMounted) setUsage(status);
    }).catch((requestError: unknown) => {
      if (isMounted) setError(requestError instanceof Error ? requestError.message : 'Nie udało się pobrać statusu Premium.');
    });
    const unsubscribe = subscribeUsage((status) => {
      if (isMounted) setUsage(status);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const { checkoutUrl } = await createPremiumCheckout();
      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, 'forest-sense://premium');
      if (result.type === 'success') {
        const latestUsage = await getUsage();
        setUsage(latestUsage);
        if (latestUsage.plan !== 'premium') {
          setError('Płatność jest potwierdzana. Za moment odświeżymy status subskrypcji.');
        }
      } else if (result.type === 'cancel') {
        const latestUsage = await getUsage();
        setUsage(latestUsage);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nie udało się otworzyć płatności Stripe.');
    } finally {
      setLoading(false);
    }
  };

  const manageSubscription = async () => {
    setLoading(true);
    setError(null);
    try {
      const { portalUrl } = await createBillingPortal();
      await WebBrowser.openAuthSessionAsync(portalUrl, 'forest-sense://premium');
      setUsage(await getUsage());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nie udało się otworzyć zarządzania subskrypcją.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Premium</Text>
      <PremiumOffer
        usage={usage}
        loggedIn={Boolean(user)}
        loading={loading}
        error={error}
        onSubscribe={() => void startCheckout()}
        onManage={() => void manageSubscription()}
        onLogin={openAuth}
      />
      <PremiumPlans />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#081a14' },
  content: { padding: 20, paddingTop: 30, paddingBottom: 32 },
  title: { color: '#edf9f1', fontSize: 28, fontWeight: '800', marginBottom: 18 },
});
