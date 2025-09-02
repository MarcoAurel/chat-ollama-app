// ================================
// 🧪 App Component Tests
// Testing main application component
// ================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from '../App';

// Mock axios
vi.mock('../utils/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }
}));

import axios from '../utils/axios';

describe('🎨 App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Initial Render', () => {
    it('should render login form initially', () => {
      render(<App />);
      
      expect(screen.getByText('Acceso por Área')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Área (Ej: informatica)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
      expect(screen.getByText('Ingresar')).toBeInTheDocument();
    });

    it('should have Luckia logo', () => {
      render(<App />);
      
      const logos = screen.getAllByAltText('Luckia');
      expect(logos.length).toBeGreaterThan(0);
    });

    it('should have theme toggle button', () => {
      render(<App />);
      
      const themeButton = screen.getByRole('button', { name: /claro|oscuro/i });
      expect(themeButton).toBeInTheDocument();
    });
  });

  describe('Theme Management', () => {
    it('should toggle between light and dark theme', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const themeButton = screen.getByRole('button', { name: /claro|oscuro/i });
      
      // Should start with system preference (mocked as light)
      expect(themeButton).toHaveTextContent(/oscuro/i);
      
      // Toggle to dark
      await user.click(themeButton);
      expect(themeButton).toHaveTextContent(/claro/i);
      
      // Toggle back to light
      await user.click(themeButton);
      expect(themeButton).toHaveTextContent(/oscuro/i);
    });

    it('should persist theme in localStorage', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const themeButton = screen.getByRole('button', { name: /claro|oscuro/i });
      
      await user.click(themeButton);
      
      expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  describe('Login Flow', () => {
    it('should handle successful login', async () => {
      const user = userEvent.setup();
      
      // Mock successful login response
      axios.post.mockResolvedValueOnce({
        data: {
          agent_config: {
            model: 'llama3.2:1b',
            system_prompt: 'Test prompt'
          }
        }
      });

      // Mock sessions response
      axios.get.mockResolvedValueOnce({
        data: { sessions: [] }
      });
      
      render(<App />);
      
      // Fill login form
      await user.type(screen.getByPlaceholderText('Área (Ej: informatica)'), 'informatica');
      await user.type(screen.getByPlaceholderText('Contraseña'), 'claveinformatica');
      
      // Submit login
      await user.click(screen.getByText('Ingresar'));
      
      // Wait for login success
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith('/api/login', {
          area: 'informatica',
          password: 'claveinformatica'
        });
      });
    });

    it('should display welcome message after login', async () => {
      const user = userEvent.setup();
      
      axios.post.mockResolvedValueOnce({
        data: { agent_config: { model: 'test' } }
      });
      axios.get.mockResolvedValueOnce({
        data: { sessions: [] }
      });
      
      render(<App />);
      
      await user.type(screen.getByPlaceholderText('Área (Ej: informatica)'), 'informatica');
      await user.type(screen.getByPlaceholderText('Contraseña'), 'test');
      await user.click(screen.getByText('Ingresar'));
      
      await waitFor(() => {
        expect(screen.getByText('¡Bienvenido al Chat de Luckia! Tu asistente de informática está aquí para ayudarte. ¿En qué puedo asistirte hoy?')).toBeInTheDocument();
      });
    });

    it('should handle login error', async () => {
      const user = userEvent.setup();
      
      axios.post.mockRejectedValueOnce(new Error('Invalid credentials'));
      
      render(<App />);
      
      await user.type(screen.getByPlaceholderText('Área (Ej: informatica)'), 'wrong');
      await user.type(screen.getByPlaceholderText('Contraseña'), 'wrong');
      await user.click(screen.getByText('Ingresar'));
      
      // Should still show login form
      await waitFor(() => {
        expect(screen.getByText('Acceso por Área')).toBeInTheDocument();
      });
    });
  });

  describe('Chat Interface', () => {
    beforeEach(async () => {
      // Mock successful login
      axios.post.mockResolvedValueOnce({
        data: { agent_config: { model: 'test' } }
      });
      axios.get.mockResolvedValueOnce({
        data: { sessions: [] }
      });
      
      const user = userEvent.setup();
      render(<App />);
      
      await user.type(screen.getByPlaceholderText('Área (Ej: informatica)'), 'informatica');
      await user.type(screen.getByPlaceholderText('Contraseña'), 'test');
      await user.click(screen.getByText('Ingresar'));
      
      await waitFor(() => {
        expect(screen.getByText('Conectado al agente')).toBeInTheDocument();
      });
    });

    it('should render chat interface after login', () => {
      expect(screen.getByText('Conectado al agente')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/escribe tu mensaje/i)).toBeInTheDocument();
      expect(screen.getByText('Enviar')).toBeInTheDocument();
    });

    it('should have navigation buttons', () => {
      expect(screen.getByTitle(/historial/i)).toBeInTheDocument();
      expect(screen.getByTitle(/nueva conversaci/i)).toBeInTheDocument();
      expect(screen.getByTitle(/limpiar/i)).toBeInTheDocument();
      expect(screen.getByTitle(/salir/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle Escape key', () => {
      render(<App />);
      
      // Simulate Escape key press
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Should not crash and handle gracefully
      expect(screen.getByText('Acceso por Área')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      
      axios.post.mockRejectedValueOnce(new Error('Network error'));
      
      render(<App />);
      
      await user.type(screen.getByPlaceholderText('Área (Ej: informatica)'), 'test');
      await user.type(screen.getByPlaceholderText('Contraseña'), 'test');
      await user.click(screen.getByText('Ingresar'));
      
      // Should handle error without crashing
      expect(screen.getByText('Acceso por Área')).toBeInTheDocument();
    });
  });
});