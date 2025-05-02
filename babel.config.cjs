module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          node: "current",
        },
        modules: false,
      },
    ],
    ["@babel/preset-react", { runtime: "automatic" }],
  ],
  plugins: [
    [
      "@babel/plugin-transform-runtime",
      {
        regenerator: true,
        helpers: true,
        useESModules: true,
      },
    ],
  ],
  env: {
    test: {
      presets: [
        [
          "@babel/preset-env",
          {
            targets: {
              node: "current",
            },
            modules: "commonjs",
          },
        ],
        ["@babel/preset-react", { runtime: "automatic" }],
      ],
      plugins: [
        [
          "@babel/plugin-transform-runtime",
          {
            regenerator: true,
            helpers: true,
            useESModules: false,
          },
        ],
        "@babel/plugin-transform-modules-commonjs",
      ],
    },
  },
};
