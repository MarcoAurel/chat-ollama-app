// ================================
// 🧪 Vitest Configuration - Frontend
// Luckia Chat Testing Setup
// ================================

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./src/tests/setup.js'],
    
    // Global test utilities
    globals: true,
    
    // Coverage configuration
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        'dist/',
        'coverage/'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    
    // Test patterns
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}'
    ],
    
    // Test timeout
    testTimeout: 5000,
    
    // Mock CSS imports
    css: false,
    
    // Environment variables
    env: {
      NODE_ENV: 'test'
    }
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});