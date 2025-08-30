import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

const MarkdownMessage = ({ content, darkMode = false }) => {
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Add toast notification
      console.log('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');

    if (!inline && match) {
      return (
        <div className="relative group">
          {/* Copy button */}
          <button
            onClick={() => copyToClipboard(codeString)}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs font-medium z-10"
            title="Copiar código"
          >
            📋 Copiar
          </button>
          
          {/* Language label */}
          {language && (
            <div className="absolute top-2 left-2 bg-gray-600 text-white px-2 py-1 rounded text-xs font-medium opacity-75">
              {language}
            </div>
          )}
          
          <SyntaxHighlighter
            style={darkMode ? vscDarkPlus : vs}
            language={language}
            PreTag="div"
            className="!mt-0 !mb-4"
            showLineNumbers={codeString.split('\n').length > 5}
            wrapLines={true}
            wrapLongLines={true}
            customStyle={{
              borderRadius: '8px',
              padding: '1rem',
              paddingTop: language ? '2.5rem' : '1rem',
              fontSize: '14px',
              lineHeight: '1.4'
            }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Inline code
    return (
      <code
        className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200"
        {...props}
      >
        {children}
      </code>
    );
  };

  return (
    <div className="markdown-content prose dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          code: CodeBlock,
          
          // Custom heading styles
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-6 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-5 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">
              {children}
            </h3>
          ),
          
          // Custom list styles
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-3 text-gray-700 dark:text-gray-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-3 text-gray-700 dark:text-gray-300">
              {children}
            </ol>
          ),
          
          // Custom paragraph styles
          p: ({ children }) => (
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed my-2">
              {children}
            </p>
          ),
          
          // Custom link styles
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 underline transition-colors"
            >
              {children}
            </a>
          ),
          
          // Custom blockquote styles
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-orange-500 pl-4 py-2 my-4 bg-gray-50 dark:bg-gray-800 italic text-gray-700 dark:text-gray-300">
              {children}
            </blockquote>
          ),
          
          // Custom table styles
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-4 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-300">
              {children}
            </td>
          ),
          
          // Custom horizontal rule
          hr: () => (
            <hr className="my-6 border-gray-300 dark:border-gray-600" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default memo(MarkdownMessage);