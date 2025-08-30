import React, { useState, memo } from 'react';

const CopyButton = ({ text, className = "", onCopySuccess, onCopyError }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopySuccess?.();
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        onCopySuccess?.();
      } catch (fallbackErr) {
        onCopyError?.(fallbackErr);
      }
    }
  };

  return (
    <button
      onClick={copyToClipboard}
      className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-600/80 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs font-medium ${className}`}
      title={copied ? "¡Copiado!" : "Copiar mensaje"}
    >
      {copied ? "✅" : "📋"}
    </button>
  );
};

export default memo(CopyButton);