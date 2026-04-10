import "@testing-library/jest-dom/vitest";

// jsdom doesn't always provide a working localStorage — provide a simple in-memory shim
const store = {};
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });
