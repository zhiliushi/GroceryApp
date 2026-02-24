module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Required for WatermelonDB
    ['@babel/plugin-proposal-decorators', {legacy: true}],
  ],
};
