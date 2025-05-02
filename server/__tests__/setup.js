// Mock the logger
import { jest } from "@jest/globals";

jest.mock("../logger.js", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
