import React from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';

export function ConditionNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white dark:bg-gray-900 border-2 border-yellow-500 min-w-[200px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-yellow-500"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-yellow-500">
          <GitBranch className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Condition</div>
          <div className="font-bold text-gray-900 dark:text-gray-100">{data.label}</div>
        </div>
      </div>

      {data.description && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{data.description}</div>
      )}

      <div className="flex justify-between mt-2">
        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
          className="w-3 h-3 bg-green-500"
          style={{ left: '25%' }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          className="w-3 h-3 bg-red-500"
          style={{ left: '75%' }}
        />
      </div>
    </div>
  );
}
