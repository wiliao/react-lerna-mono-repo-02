export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterFramework: ["./jest.setup.ts"],
  moduleNameMapper: {
    "@demo/common": "<rootDir>/../common/src",
  },
};
