import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap, UserPlus, UserMinus, Clock, TrendingDown, DollarSign } from 'lucide-react';

const triggerIcons = {
  'user-created': UserPlus,
  'user-updated': Zap,
  'user-expired': Clock,
  'user-churned': TrendingDown,
  'payment-received': DollarSign,
  'user-deleted': UserMinus,
};

export function TriggerNode({ data }: NodeProps) {
  const Icon = triggerIcons[data.triggerType as keyof typeof triggerIcons] || Zap;

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-blue-500 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 uppercase">Trigger</div>
          <div className="font-bold">{data.label}</div>
        </div>
      </div>
      
      {data.description && (
        <div className="text-xs text-gray-600 mt-1">{data.description}</div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
}
