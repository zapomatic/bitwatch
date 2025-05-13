import memory from "./memory.js";

// getAddressObj returns an object with:
// - collectionName: name of the collection
// - address: address object (reference in memory.db.collections)
// - extendedKey: extendedKey obj's key (extendedKey.key)
// - descriptor: descriptor obj's descriptor (descriptor.descriptor)
export default (address) => {
  for (const [collectionName, collection] of Object.entries(
    memory.db.collections
  )) {
    // Check regular addresses
    const addr = collection.addresses.find((a) => a.address === address);
    if (addr) {
      return { collectionName, address: addr };
    }
    // Check extended key addresses
    if (collection.extendedKeys) {
      for (const key of collection.extendedKeys) {
        const addr = key.addresses.find((a) => a.address === address);
        if (addr) {
          return {
            collectionName,
            address: addr,
            extendedKey: key.key,
          };
        }
      }
    }
    // Check descriptor addresses
    if (collection.descriptors) {
      for (const desc of collection.descriptors) {
        const addr = desc.addresses.find((a) => a.address === address);
        if (addr) {
          return {
            collectionName,
            address: addr,
            descriptor: desc.descriptor,
          };
        }
      }
    }
  }
  return null;
};
