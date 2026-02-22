// packages/web/jest.config.ts
import type { Config } from "jest"; // ✅ use base Config type — includes setupFilesAfterEnv

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",

  // ✅ Uncommented — loads jest-dom matchers before every test
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],

  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        isolatedModules: true,
      },
    ],
  },

  moduleNameMapper: {
    "^@demo/common$": "<rootDir>/../common/dist/index.js",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(jpg|jpeg|png|gif|svg|webp)$": "<rootDir>/src/__mocks__/fileMock.ts",
  },

  clearMocks: true,
  verbose: true,
};

export default config;
