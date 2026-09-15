export function resilientStorage(nativeStorage) {
  const memory = new Map();
  let persistent = Boolean(nativeStorage);
  return {
    get persistent() { return persistent; },
    getItem(key) {
      if (persistent) {
        try {
          const value = nativeStorage.getItem(key);
          if (value !== null) memory.set(key, value);
          return value;
        } catch { persistent = false; }
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      if (persistent) {
        try { nativeStorage.setItem(key, value); }
        catch { persistent = false; }
      }
    },
  };
}
