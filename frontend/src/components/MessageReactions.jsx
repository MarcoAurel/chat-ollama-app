import React, { useState } from 'react';

const MessageReactions = ({ messageId, darkMode = false, onReaction }) => {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleLike = () => {
    if (liked) {
      setLiked(false);
      onReaction?.(messageId, null);
    } else {
      setLiked(true);
      setDisliked(false);
      onReaction?.(messageId, 'like');
    }
  };

  const handleDislike = () => {
    if (disliked) {
      setDisliked(false);
      onReaction?.(messageId, null);
    } else {
      setDisliked(true);
      setLiked(false);
      setShowFeedback(true);
      onReaction?.(messageId, 'dislike');
    }
  };

  return (
    <div className="flex items-center space-x-2 mt-2">
      {/* Like button */}
      <button
        onClick={handleLike}
        className={`transition-all duration-200 hover:scale-110 ${
          liked
            ? 'text-green-500 dark:text-green-400'
            : 'text-gray-400 hover:text-green-500 dark:hover:text-green-400'
        }`}
        title={liked ? "Quitar like" : "Me gusta"}
      >
        {liked ? '👍' : '👍🏻'}
      </button>

      {/* Dislike button */}
      <button
        onClick={handleDislike}
        className={`transition-all duration-200 hover:scale-110 ${
          disliked
            ? 'text-red-500 dark:text-red-400'
            : 'text-gray-400 hover:text-red-500 dark:hover:text-red-400'
        }`}
        title={disliked ? "Quitar dislike" : "No me gusta"}
      >
        {disliked ? '👎' : '👎🏻'}
      </button>

      {/* Status indicator */}
      {(liked || disliked) && (
        <span className="text-xs text-gray-500 dark:text-gray-400 animate-in fade-in duration-300">
          {liked ? '¡Gracias por tu feedback positivo!' : 'Gracias, trabajaremos en mejorar'}
        </span>
      )}

      {/* Feedback form for negative reactions */}
      {showFeedback && disliked && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 w-64">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            ¿Qué podríamos mejorar? (opcional)
          </p>
          <textarea
            placeholder="Tu sugerencia..."
            className="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
            rows="2"
          />
          <div className="flex justify-end space-x-2 mt-2">
            <button
              onClick={() => setShowFeedback(false)}
              className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Saltar
            </button>
            <button
              onClick={() => {
                setShowFeedback(false);
                // TODO: Enviar feedback al backend
              }}
              className="text-xs px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageReactions;