import React, { useState, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';

export function CommentNode({ data, id }: { data: any, id?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.text || 'Add a note...');

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (data.onChange) {
      data.onChange(id, text);
    }
  }, [text, id, data]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  }, []);

  return (
    <div 
      className="px-4 py-3 shadow-md rounded-md bg-white border-2 border-gray-300 border-dashed min-w-[200px] max-w-[300px]"
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-start gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 flex-shrink-0">
          <MessageSquare className="h-3.5 w-3.5 text-gray-600" />
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Comment</div>
          {isEditing ? (
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
              style={{ minHeight: '60px' }}
              placeholder="Add a note..."
            />
          ) : (
            <div 
              className="text-sm text-gray-700 whitespace-pre-wrap cursor-text hover:bg-gray-50 px-2 py-1 rounded"
              title="Double-click to edit"
            >
              {text || 'Add a note...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
