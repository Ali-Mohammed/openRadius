import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { paymentApi } from '@/api/paymentApi';

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('transactionId');
  const workspaceId = searchParams.get('workspaceId');
  const [status, setStatus] = useState<'success' | 'failed' | 'cancelled'>('success');

  // Determine status from URL
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/payment/success')) {
      setStatus('success');
    } else if (path.includes('/payment/failed')) {
      setStatus('failed');
    } else if (path.includes('/payment/cancelled')) {
      setStatus('cancelled');
    }
  }, []);

  // Fetch payment status
  const { data: paymentStatus, isLoading } = useQuery({
    queryKey: ['paymentStatus', transactionId],
    queryFn: () => paymentApi.getPaymentStatus(transactionId!, workspaceId ?? undefined),
    enabled: !!transactionId,
    refetchInterval: status === 'success' ? false : 3000, // Refetch every 3s if not success
  });

  const getIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-20 w-20 text-green-500" />;
      case 'failed':
        return <XCircle className="h-20 w-20 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-20 w-20 text-yellow-500" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'success':
        return 'Payment Successful!';
      case 'failed':
        return 'Payment Failed';
      case 'cancelled':
        return 'Payment Cancelled';
    }
  };

  const getDescription = () => {
    switch (status) {
      case 'success':
        return 'Your payment has been processed successfully and funds have been added to your wallet.';
      case 'failed':
        return 'Your payment could not be processed. Please try again or contact support.';
      case 'cancelled':
        return 'You have cancelled the payment process.';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            {isLoading ? (
              <Loader2 className="h-20 w-20 animate-spin text-primary" />
            ) : (
              getIcon()
            )}
          </div>
          <CardTitle className="text-2xl">{getTitle()}</CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-center text-muted-foreground">
              <p>Loading payment details...</p>
            </div>
          ) : paymentStatus ? (
            <>
              {/* Payment Details */}
              <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-mono text-xs">{paymentStatus.transactionId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">
                    {formatCurrency(paymentStatus.amount)} {paymentStatus.currency}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gateway</span>
                  <span className="capitalize">{paymentStatus.gateway}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="capitalize font-semibold">{paymentStatus.status}</span>
                </div>
                {paymentStatus.completedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Completed At</span>
                    <span>{new Date(paymentStatus.completedAt).toLocaleString()}</span>
                  </div>
                )}
                {paymentStatus.errorMessage && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-red-600">{paymentStatus.errorMessage}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Link to="/settings?tab=payment-methods">
                  <Button className="w-full" variant={status === 'success' ? 'default' : 'outline'}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Payment Methods
                  </Button>
                </Link>
                {status !== 'success' && (
                  <Link to="/settings?tab=payment-methods">
                    <Button className="w-full">Try Again</Button>
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground">
              <p>No payment details available</p>
              <Link to="/settings?tab=payment-methods">
                <Button className="mt-4" variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Payment Methods
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
