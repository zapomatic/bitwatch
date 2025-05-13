import memory from "../memory.js";

export default () => {
  const allAddresses = [];
  for (const [collectionName, collection] of Object.entries(
    memory.db.collections
  )) {
    // Add regular addresses
    collection.addresses.forEach((addr) => {
      allAddresses.push({
        ...addr,
        collection: collectionName,
      });
    });

    // Add extended key addresses
    if (collection.extendedKeys) {
      collection.extendedKeys.forEach((extendedKey) => {
        extendedKey.addresses.forEach((addr) => {
          allAddresses.push({
            ...addr,
            collection: collectionName,
          });
        });
      });
    }

    // Add descriptor addresses
    if (collection.descriptors) {
      collection.descriptors.forEach((descriptor) => {
        descriptor.addresses.forEach((addr) => {
          allAddresses.push({
            ...addr,
            collection: collectionName,
          });
        });
      });
    }
  }
  return allAddresses;
};
