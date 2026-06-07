// Exclude @nozbe/watermelondb from native autolinking until the offline-sync
// engine is wired up. The TypeScript types in src/watermelon/schema.ts still
// resolve, but the native module is not compiled into the iOS/Android binary.
// To re-enable: delete this file (or remove the @nozbe/watermelondb entry).
module.exports = {
  dependencies: {
    "@nozbe/watermelondb": {
      platforms: {
        ios: null,
        android: null
      }
    }
  }
};
