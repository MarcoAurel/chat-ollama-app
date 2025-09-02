// ================================
// 🧪 Backend Test Setup
// Global test configuration
// ================================

// Environment variables for testing
process.env.NODE_ENV = 'test';
process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
process.env.AREA_CONFIG_PATH = './config/area_config.json';
process.env.SESSION_SECRET = 'test-secret-key';

// Suppress console logs during testing (optional)
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Global test utilities
global.TEST_TIMEOUT = 10000;
global.API_BASE_URL = 'http://localhost:3001';

// Mock external dependencies that might not be available during testing
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test helpers
global.mockOllamaResponse = (response = 'Test response from Ollama') => {
  return {
    data: {
      response: response,
      model: 'test-model',
      done: true
    }
  };
};

global.mockUser = {
  area: 'informatica',
  password: 'claveinformatica'
};

global.mockMessage = {
  prompt: 'Test message',
  area: 'informatica',
  sessionId: 'test-session-id'
};

console.log('🧪 Backend test setup completed');