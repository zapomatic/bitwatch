import memory from "./memory.js";

export default () => {
  const allAddresses = [];
  for (const [collectionName, collection] of Object.entries(
    memory.db.collections
  )) {
    // Add regular addresses
    collection.addresses.forEach((addr) => {
      allAddresses.push({
        address: addr.address,
        collectionName,
        extendedKeyName: undefined,
        descriptorName: undefined,
      });
    });

    // Add extended key addresses
    if (collection.extendedKeys) {
      collection.extendedKeys.forEach((extendedKey) => {
        extendedKey.addresses.forEach((addr) => {
          allAddresses.push({
            address: addr.address,
            collectionName,
            extendedKeyName: extendedKey.key,
            descriptorName: undefined,
          });
        });
      });
    }

    // Add descriptor addresses
    if (collection.descriptors) {
      collection.descriptors.forEach((descriptor) => {
        descriptor.addresses.forEach((addr) => {
          allAddresses.push({
            address: addr.address,
            collectionName,
            extendedKeyName: undefined,
            descriptorName: descriptor.descriptor,
          });
        });
      });
    }
  }
  return allAddresses;
};
