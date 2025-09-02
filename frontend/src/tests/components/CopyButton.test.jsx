// ================================
// 🧪 CopyButton Component Tests
// Testing copy to clipboard functionality
// ================================

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CopyButton from '../../components/CopyButton';

describe('📋 CopyButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default icon', () => {
      render(<CopyButton text="Test text" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('📋');
    });

    it('should have correct default title', () => {
      render(<CopyButton text="Test text" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Copiar mensaje');
    });

    it('should apply custom className', () => {
      render(<CopyButton text="Test text" className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Copy Functionality', () => {
    it('should copy text to clipboard successfully', async () => {
      const user = userEvent.setup();
      const onCopySuccess = vi.fn();
      
      render(
        <CopyButton 
          text="Test text to copy" 
          onCopySuccess={onCopySuccess}
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Check if clipboard was called
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test text to copy');
      
      // Wait for success callback
      await waitFor(() => {
        expect(onCopySuccess).toHaveBeenCalled();
      });
    });

    it('should show success state after copy', async () => {
      const user = userEvent.setup();
      
      render(<CopyButton text="Test text" />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Should show success icon
      await waitFor(() => {
        expect(button).toHaveTextContent('✅');
        expect(button).toHaveAttribute('title', '¡Copiado!');
      });
    });

    it('should reset after timeout', async () => {
      const user = userEvent.setup();
      vi.useFakeTimers();
      
      render(<CopyButton text="Test text" />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Should show success state
      await waitFor(() => {
        expect(button).toHaveTextContent('✅');
      });
      
      // Fast-forward time
      vi.advanceTimersByTime(2000);
      
      // Should reset to default
      await waitFor(() => {
        expect(button).toHaveTextContent('📋');
        expect(button).toHaveAttribute('title', 'Copiar mensaje');
      });
      
      vi.useRealTimers();
    });

    it('should handle copy errors gracefully', async () => {
      const user = userEvent.setup();
      const onCopyError = vi.fn();
      
      // Mock clipboard API failure
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));
      
      // Mock fallback execCommand
      document.execCommand = vi.fn().mockReturnValue(true);
      
      render(
        <CopyButton 
          text="Test text" 
          onCopyError={onCopyError}
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Should still show success (fallback worked)
      await waitFor(() => {
        expect(button).toHaveTextContent('✅');
      });
    });

    it('should handle complete failure', async () => {
      const user = userEvent.setup();
      const onCopyError = vi.fn();
      
      // Mock both clipboard API and execCommand failure
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));
      document.execCommand = vi.fn().mockReturnValue(false);
      
      render(
        <CopyButton 
          text="Test text" 
          onCopyError={onCopyError}
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Should call error callback
      await waitFor(() => {
        expect(onCopyError).toHaveBeenCalled();
      });
      
      // Should not show success state
      expect(button).toHaveTextContent('📋');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      const onCopySuccess = vi.fn();
      
      render(<CopyButton text="Test text" onCopySuccess={onCopySuccess} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      // Press Enter
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(onCopySuccess).toHaveBeenCalled();
      });
    });

    it('should have proper ARIA attributes', () => {
      render(<CopyButton text="Test text" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', async () => {
      const user = userEvent.setup();
      
      render(<CopyButton text="" />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
    });

    it('should handle very long text', async () => {
      const user = userEvent.setup();
      const longText = 'a'.repeat(10000);
      
      render(<CopyButton text={longText} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(longText);
    });

    it('should handle special characters', async () => {
      const user = userEvent.setup();
      const specialText = '🎉 Special chars: áéíóú ñ @#$%^&*()';
      
      render(<CopyButton text={specialText} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(specialText);
    });
  });
});