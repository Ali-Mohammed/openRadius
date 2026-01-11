import React from 'react';
import { Handle, Position } from 'reactflow';
import { Mail, MessageSquare, DollarSign, Ban, Gift, CreditCard, User } from 'lucide-react';

const actionIcons = {
  'send-email': Mail,
  'send-notification': MessageSquare,
  'credit-wallet': DollarSign,
  'debit-wallet': CreditCard,
  'suspend-user': Ban,
  'apply-discount': Gift,
  'update-profile': User,
};

export function ActionNode({ data }: { data: any }) {
  const Icon = actionIcons[data.actionType as keyof typeof actionIcons] || Mail;

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-green-500 min-w-[200px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-green-500"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 uppercase">Action</div>
          <div className="font-bold">{data.label}</div>
        </div>
      </div>

      {data.description && (
        <div className="text-xs text-gray-600 mt-1">{data.description}</div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-green-500"
      />
    </div>
  );
}
