import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { paymentApi } from '@/api/paymentApi';
import { paymentMethodApi, type PaymentMethod } from '@/api/paymentMethodApi';

interface PaymentTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentTestDialog({ open, onOpenChange }: PaymentTestDialogProps) {
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [amount, setAmount] = useState<string>('1000');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Fetch available payment methods
  const { data: paymentMethods, isLoading: loadingMethods } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: paymentMethodApi.getAll,
  });

  // Fetch wallet balance
  const { data: walletBalance, isLoading: loadingBalance } = useQuery({
    queryKey: ['walletBalance'],
    queryFn: paymentApi.getWalletBalance,
  });

  // Payment initiation mutation
  const initiatePaymentMutation = useMutation({
    mutationFn: paymentApi.initiatePayment,
    onSuccess: (response) => {
      if (response.success && response.paymentUrl) {
        setSuccess('Redirecting to payment gateway...');
        // Open payment URL in new window
        window.open(response.paymentUrl, '_blank');
        
        // Reset form
        setTimeout(() => {
          setAmount('150000');
          setSelectedMethodId('');
          setSuccess('');
          onOpenChange(false);
        }, 2000);
      } else {
        setError(response.errorMessage || 'Failed to initiate payment');
      }
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'An error occurred');
    },
  });

  const handlePayment = () => {
    setError('');
    setSuccess('');

    // Validation
    const amountNum = parseFloat(amount);
    if (!selectedMethodId) {
      setError('Please select a payment method');
      return;
    }
    if (isNaN(amountNum) || amountNum < 250) {
      setError('Minimum amount is 250 IQD');
      return;
    }
    if (amountNum >= 150000) {
      setError('Maximum amount is 149,999 IQD');
      return;
    }

    // Initiate payment
    initiatePaymentMutation.mutate({
      paymentMethodId: parseInt(selectedMethodId),
      amount: amountNum,
      serviceType: 'wallet_topup',
    });
  };

  const selectedMethod = paymentMethods?.find(
    (pm: PaymentMethod) => pm.id.toString() === selectedMethodId
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Test
          </DialogTitle>
          <DialogDescription>
            Test payment integration and add funds to your wallet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Balance */}
          {walletBalance && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="text-sm text-muted-foreground">Current Balance</div>
              <div className="text-2xl font-bold">
                {formatCurrency(walletBalance.currentBalance)} IQD
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Status: <span className="capitalize">{walletBalance.status}</span>
              </div>
            </div>
          )}

          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select
              value={selectedMethodId}
              onValueChange={setSelectedMethodId}
              disabled={loadingMethods}
            >
              <SelectTrigger id="paymentMethod" className="border">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods
                  ?.filter((pm: PaymentMethod) => pm.isActive)
                  .map((pm: PaymentMethod) => (
                    <SelectItem key={pm.id} value={pm.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pm.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({pm.type})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {selectedMethod && (
              <p className="text-xs text-muted-foreground">
                Gateway: {selectedMethod.type}
              </p>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount (IQD)
              <span className="ml-1 text-xs text-muted-foreground">
                (250 - 149,999)
              </span>
            </Label>
            <Input
              id="amount"
              type="number"
              min="250"
              max="149999"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
            />
            {amount && parseFloat(amount) >= 250 && parseFloat(amount) < 150000 && (
              <p className="text-xs text-muted-foreground">
                You will pay: {formatCurrency(parseFloat(amount))} IQD
              </p>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="border-green-500 bg-green-50 text-green-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={initiatePaymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              className="flex-1"
              disabled={
                initiatePaymentMutation.isPending ||
                !selectedMethodId ||
                !amount ||
                parseFloat(amount) < 250 ||
                parseFloat(amount) >= 150000
              }
            >
              {initiatePaymentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay Now
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
