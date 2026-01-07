export const TRANSACTION_TYPES = {
  TOP_UP: 'topup',
  WITHDRAWAL: 'withdrawal',
  TRANSFER: 'transfer',
  ADJUSTMENT: 'adjustment',
  PURCHASE: 'purchase',
  REFUND: 'refund',
  PAYMENT: 'payment',
  REWARD: 'reward',
  FEE: 'fee',
  COMMISSION: 'commission',
} as const

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES]

export const TRANSACTION_TYPE_INFO: Record<TransactionType, {
  label: string
  isCredit: boolean
  color: string
}> = {
  [TRANSACTION_TYPES.TOP_UP]: {
    label: 'Top Up',
    isCredit: true,
    color: 'text-green-600',
  },
  [TRANSACTION_TYPES.WITHDRAWAL]: {
    label: 'Withdrawal',
    isCredit: false,
    color: 'text-red-600',
  },
  [TRANSACTION_TYPES.TRANSFER]: {
    label: 'Transfer',
    isCredit: false,
    color: 'text-blue-600',
  },
  [TRANSACTION_TYPES.ADJUSTMENT]: {
    label: 'Adjustment',
    isCredit: true,
    color: 'text-yellow-600',
  },
  [TRANSACTION_TYPES.PURCHASE]: {
    label: 'Purchase',
    isCredit: false,
    color: 'text-orange-600',
  },
  [TRANSACTION_TYPES.REFUND]: {
    label: 'Refund',
    isCredit: true,
    color: 'text-purple-600',
  },
  [TRANSACTION_TYPES.PAYMENT]: {
    label: 'Payment',
    isCredit: false,
    color: 'text-pink-600',
  },
  [TRANSACTION_TYPES.REWARD]: {
    label: 'Reward',
    isCredit: true,
    color: 'text-emerald-600',
  },
  [TRANSACTION_TYPES.FEE]: {
    label: 'Fee',
    isCredit: false,
    color: 'text-amber-600',
  },
  [TRANSACTION_TYPES.COMMISSION]: {
    label: 'Commission',
    isCredit: false,
    color: 'text-cyan-600',
  },
}

export const isCredit = (transactionType: TransactionType): boolean => {
  return TRANSACTION_TYPE_INFO[transactionType]?.isCredit ?? false
}

export const isDebit = (transactionType: TransactionType): boolean => {
  return !isCredit(transactionType)
}

export const getTransactionTypeLabel = (transactionType: TransactionType): string => {
  return TRANSACTION_TYPE_INFO[transactionType]?.label ?? transactionType
}

export const getTransactionTypeColor = (transactionType: TransactionType): string => {
  return TRANSACTION_TYPE_INFO[transactionType]?.color ?? 'text-gray-600'
}
