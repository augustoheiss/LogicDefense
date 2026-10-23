module.exports = ({ config }) => {
  const isWebExport =
    process.env.EXPO_PUBLIC_PLATFORM === 'web' ||
    process.argv.some(
      (arg, index) =>
        (arg === '--platform' || arg === '-p') && process.argv[index + 1] === 'web'
    ) ||
    process.argv.includes('--web');

  const experiments = {
    ...(config.experiments || {}),
  };

  if (isWebExport) {
    experiments.baseUrl = '/laboratorio/sekundo';
  } else {
    delete experiments.baseUrl;
  }

  return {
    ...config,
    experiments,
  };
};
