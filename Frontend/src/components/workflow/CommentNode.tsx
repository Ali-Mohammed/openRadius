import React from 'react';
import { MessageSquare } from 'lucide-react';

export function CommentNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-white border-2 border-gray-300 border-dashed min-w-[200px] max-w-[300px]">
      <div className="flex items-start gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 flex-shrink-0">
          <MessageSquare className="h-3.5 w-3.5 text-gray-600" />
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Comment</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{data.text || 'Add a note...'}</div>
        </div>
      </div>
    </div>
  );
}
