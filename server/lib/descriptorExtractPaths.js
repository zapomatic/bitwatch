export const descriptorExtractPaths = (descriptor) => {
  // Match all derivation paths ending in /* inside the descriptor
  const matches = [...descriptor.matchAll(/\/([0-9h/'/]+)\/\*/g)];

  // Extract and normalize the paths
  const paths = matches.map((match) => `m/${match[1]}`);

  // Deduplicate and join
  const uniquePaths = [...new Set(paths)];

  return uniquePaths.join(",");
};
