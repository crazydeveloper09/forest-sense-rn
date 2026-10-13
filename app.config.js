const app = require('./app.json');

module.exports = () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    if (process.env.EAS_BUILD === 'true') {
      throw new Error('Ustaw GOOGLE_MAPS_API_KEY w środowisku EAS. Bez tego klucza mapa na Androidzie zamyka aplikację.');
    }
    return app;
  }

  return {
    expo: {
      ...app.expo,
      android: {
        ...app.expo.android,
        config: {
          ...app.expo.android.config,
          googleMaps: { apiKey },
        },
      },
    },
  };
};
