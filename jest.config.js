/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  // Nur reine TS-Module (kein React Native/Expo) laufen unter diesem Setup — bewusst kein
  // jest-expo Preset, damit Tests ohne Native-Modul-Mocking schnell und zuverlässig laufen.
  testPathIgnorePatterns: ['/node_modules/'],
};
