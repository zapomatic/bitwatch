module.exports = {
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
      ],
      plugins: [
        [
          "@babel/plugin-transform-runtime",
          {
            regenerator: true,
            helpers: true,
          },
        ],
      ],
    },
  },
};
