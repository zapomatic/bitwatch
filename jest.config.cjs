module.exports = {
  // Common configuration
  verbose: true,
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  extensionsToTreatAsEsm: [".jsx", ".ts", ".tsx"],

  // Module name mapping for both client and server
  moduleNameMapper: {
    // Client CSS modules
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    // Server ESM imports
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@/(.*)$": "<rootDir>/client/src/$1",
  },

  // Transform configuration for both client and server
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": [
      "babel-jest",
      {
        rootMode: "upward",
        targets: { node: "current" },
        presets: [
          [
            "@babel/preset-env",
            {
              targets: { node: "current" },
              modules: "commonjs",
            },
          ],
          ["@babel/preset-react", { runtime: "automatic" }],
        ],
        plugins: [
          [
            "@babel/plugin-transform-runtime",
            { regenerator: true, helpers: true },
          ],
        ],
      },
    ],
  },

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Test environment configuration
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    // For server tests that need node environment
    customExportConditions: ["node", "node-addons"],
  },

  // Project-specific configurations
  projects: [
    {
      displayName: "client",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/client/**/__tests__/**/*.test.js"],
      setupFilesAfterEnv: ["<rootDir>/client/src/setupTests.js"],
      moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
        "^(\\.{1,2}/.*)\\.js$": "$1",
      },
      transform: {
        "^.+\\.(js|jsx)$": [
          "babel-jest",
          {
            rootMode: "upward",
            targets: { node: "current" },
            presets: [
              [
                "@babel/preset-env",
                { targets: { node: "current" }, modules: "commonjs" },
              ],
              ["@babel/preset-react", { runtime: "automatic" }],
            ],
            plugins: [
              [
                "@babel/plugin-transform-runtime",
                { regenerator: true, helpers: true },
              ],
            ],
          },
        ],
      },
      transformIgnorePatterns: [
        "node_modules/(?!(testing-library|@emotion|@mui)/)",
      ],
    },
    {
      displayName: "server",
      testEnvironment: "node",
      testMatch: ["<rootDir>/server/**/__tests__/**/*.test.js"],
      moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
      },
      transform: {
        "^.+\\.(js|jsx)$": [
          "babel-jest",
          {
            rootMode: "upward",
            targets: { node: "current" },
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: { node: "current" },
                  modules: "commonjs",
                },
              ],
            ],
            plugins: [
              [
                "@babel/plugin-transform-runtime",
                { regenerator: true, helpers: true },
              ],
            ],
          },
        ],
      },
      setupFilesAfterEnv: ["<rootDir>/server/__tests__/setup.js"],
      setupFiles: ["<rootDir>/server/__tests__/setup.js"],
    },
  ],

  moduleFileExtensions: ["js", "jsx", "json", "node"],
  collectCoverageFrom: [
    "client/src/**/*.{js,jsx}",
    "!client/src/**/*.test.{js,jsx}",
    "!client/src/**/*.stories.{js,jsx}",
    "!client/src/**/index.{js,jsx}",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
};
