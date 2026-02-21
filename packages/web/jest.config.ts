// packages/web/jest.config.ts
import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "jsdom",

  // ✅ FIXED: Correct property name
  //setupFilesAfterEnv: ["./jest.setup.ts"],

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

  // ✅ FIXED: Point to BUILT common, not source
  moduleNameMapper: {
    "^@demo/common$": "<rootDir>/../common/dist/index.js",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(jpg|jpeg|png|gif|svg|webp)$": "<rootDir>/src/__mocks__/fileMock.ts",
  },

  clearMocks: true,
  verbose: true,
};

export default config;
