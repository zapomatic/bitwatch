import { jest } from "@jest/globals";
import "@testing-library/jest-dom";

// Mock console methods during tests
const originalConsole = { ...console };
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

beforeAll(() => {
  global.console = mockConsole;
});

afterAll(() => {
  global.console = originalConsole;
});

// Mock any global objects or functions needed for testing
global.matchMedia =
  global.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };
