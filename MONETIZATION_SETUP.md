# Forest Sense monetization setup

## Recognition limits

The API enforces 10 free recognitions per UTC calendar month and 1 Premium recognition per UTC day. A completed rewarded ad grants one additional recognition. Quota and Stripe subscription state are stored in `api/data/billing.json`; this local JSON store is an MVP and should be replaced with a managed database before running multiple API instances or serving production traffic.

The quota identity is a random installation ID in Expo SecureStore. It is not an account system; reinstalling the app can create a new ID. Add sign-in/account recovery before treating entitlements as transferable between devices.

## Stripe

1. Copy `.env.example` values into the local server `.env` without committing that file.
2. Set `STRIPE_SECRET_KEY` to a test key while developing.
3. Deploy the API at a public HTTPS origin and set `PUBLIC_API_URL` to that origin. Stripe Checkout must be able to return to `/stripe/success` or `/stripe/cancel`.
4. In Stripe, create a webhook pointing to `https://<your-api>/stripe/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, and `customer.subscription.deleted`; put its signing secret in `STRIPE_WEBHOOK_SECRET`.
5. The server creates a monthly PLN subscription for 1,500 groszy (15 zł). It does not require a pre-created Stripe price.

This sample uses Stripe-hosted Checkout. Mobile marketplace rules for digital subscriptions may require Apple In-App Purchase or Google Play Billing instead of an external Stripe checkout. Confirm the rules for the storefronts and regions where the app will be distributed before release.

## AdMob

1. Replace the Google sample application IDs in `app.json` with your Android and iOS AdMob application IDs before release.
2. Set `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID` and `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID` to your production units. Add the rewarded unit ID as `ADMOB_REWARDED_AD_UNIT_ID` on the server too.
3. Configure the rewarded unit's server-side verification callback as `https://<your-api>/admob/ssv`, with reward item `recognition` and amount `1`.
4. Set `ADMOB_SSV_TOKEN_SECRET` to a random secret of at least 32 characters. The API verifies AdMob's signature, one-time token, user ID, ad unit, reward item, and transaction ID before granting the extra recognition.
5. Keep `ALLOW_UNVERIFIED_AD_REWARDS` unset or `false` in production. It exists only to test Google test ads against a local server; production rewards require the signed callback.

AdMob is a native module and cannot run in Expo Go. After changing `app.json`, build a development client with `npx expo run:android` (or an EAS development build), then start Metro with `npx expo start --dev-client`. Expo Go remains useful for UI work without native ads.

## Local API

The server reads `.env` with `npm run api`. For a physical phone, `EXPO_PUBLIC_AI_API_URL` must use the computer's LAN address, not `localhost` or `0.0.0.0`. A local API cannot receive AdMob's production SSV callbacks from Google's servers; verify rewarded credits against a publicly reachable HTTPS API.
