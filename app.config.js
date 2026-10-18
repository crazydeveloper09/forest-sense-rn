const fs = require('fs');
const app = require('./app.json');

module.exports = () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
    || (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);
  const android = {
    ...app.expo.android,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  };
  if (!apiKey) {
    if (process.env.EAS_BUILD === 'true') {
      throw new Error('Ustaw GOOGLE_MAPS_API_KEY w środowisku EAS. Bez tego klucza mapa na Androidzie zamyka aplikację.');
    }
    return { expo: { ...app.expo, android } };
  }

  return {
    expo: {
      ...app.expo,
      android: {
        ...android,
        config: {
          ...app.expo.android.config,
          googleMaps: { apiKey },
        },
      },
    },
  };
};
