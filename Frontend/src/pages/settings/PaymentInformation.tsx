import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CreditCard, DollarSign, Key, Server, Settings, CheckCircle2, XCircle, Eye, EyeOff, History, Clock, AlertCircle } from 'lucide-react'
import { paymentMethodApi, type PaymentMethod } from '@/api/paymentMethodApi'
import { paymentApi, type PaymentLog } from '@/api/paymentApi'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'

export default function PaymentInformation() {
  const [showSecrets, setShowSecrets] = useState(false)

  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: paymentMethodApi.getAll,
  })

  const { data: paymentHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['payment-history'],
    queryFn: () => paymentApi.getPaymentHistory({ pageSize: 100 }),
  })

  const maskSecret = (secret: string) => {
    if (!secret) return 'Not Set'
    if (showSecrets) return secret
    return '•'.repeat(Math.min(secret.length, 20))
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Completed</Badge>
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>
      case 'failed':
      case 'error':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return <div className="p-6">Loading payment information...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Information</h1>
          <p className="text-muted-foreground">View all payment gateway configurations and credentials</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSecrets(!showSecrets)}
        >
          {showSecrets ? (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              Hide Secrets
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Show Secrets
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-6">
        {paymentMethods?.map((method: PaymentMethod) => (
          <Card key={method.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle>{method.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span>Gateway: {method.type}</span>
                      {method.settings?.isProduction ? (
                        <Badge variant="destructive">Production</Badge>
                      ) : (
                        <Badge variant="secondary">Test Mode</Badge>
                      )}
                      {method.settings?.isActive ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Environment Mode */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Server className="h-4 w-4" />
                  Environment Configuration
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Mode</p>
                    <p className="font-medium">
                      {method.settings?.isProduction ? 'Production' : 'Test/Sandbox'}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ZainCash Specific Settings */}
              {method.type === 'ZainCash' && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Key className="h-4 w-4" />
                      Test Environment Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Merchant ID</p>
                        <p className="font-mono text-sm">{method.settings?.merchantTest || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">MSISDN</p>
                        <p className="font-mono text-sm">{method.settings?.msisdnTest || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Secret Key</p>
                        <p className="font-mono text-sm break-all">{maskSecret(method.settings?.secretTest)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Language</p>
                        <p className="font-mono text-sm">{method.settings?.langTest || 'Not Set'}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Key className="h-4 w-4" />
                      Production Environment Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Merchant ID</p>
                        <p className="font-mono text-sm">{method.settings?.merchantProd || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">MSISDN</p>
                        <p className="font-mono text-sm">{method.settings?.msisdnProd || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Secret Key</p>
                        <p className="font-mono text-sm break-all">{maskSecret(method.settings?.secretProd)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Language</p>
                        <p className="font-mono text-sm">{method.settings?.langProd || 'Not Set'}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Settings className="h-4 w-4" />
                      Additional Settings
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">API Token</p>
                        <p className="font-mono text-sm break-all">{maskSecret(method.settings?.token)}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* QICard Specific Settings */}
              {method.type === 'QICard' && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Key className="h-4 w-4" />
                      Test Environment Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Username</p>
                        <p className="font-mono text-sm">{method.settings?.usernameTest || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Password</p>
                        <p className="font-mono text-sm">{maskSecret(method.settings?.passwordTest)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Terminal ID</p>
                        <p className="font-mono text-sm">{method.settings?.terminalIdTest || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Currency</p>
                        <p className="font-mono text-sm">{method.settings?.currencyTest || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">API URL</p>
                        <p className="font-mono text-sm break-all">{method.settings?.urlTest || 'Not Set'}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Key className="h-4 w-4" />
                      Production Environment Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Username</p>
                        <p className="font-mono text-sm">{method.settings?.usernameProd || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Password</p>
                        <p className="font-mono text-sm">{maskSecret(method.settings?.passwordProd)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Terminal ID</p>
                        <p className="font-mono text-sm">{method.settings?.terminalIdProd || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Currency</p>
                        <p className="font-mono text-sm">{method.settings?.currencyProd || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">API URL</p>
                        <p className="font-mono text-sm break-all">{method.settings?.urlProd || 'Not Set'}</p>
                      </div>
                    </div>
                  </div>

                  {method.settings?.publicKey && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Key className="h-4 w-4" />
                          RSA Public Key (Signature Verification)
                        </div>
                        <div className="pl-6">
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
                            {showSecrets ? method.settings.publicKey : '*** RSA Public Key Hidden ***'}
                          </pre>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Switch Specific Settings */}
              {method.type === 'Switch' && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Key className="h-4 w-4" />
                      Test Environment Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Merchant ID</p>
                        <p className="font-mono text-sm">{method.settings?.merchantIdTest || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">API Key</p>
                        <p className="font-mono text-sm">{maskSecret(method.settings?.apiKeyTest)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Encryption Key</p>
                        <p className="font-mono text-sm">{maskSecret(method.settings?.encryptionKeyTest)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">API URL</p>
                        <p className="font-mono text-sm break-all">{method.settings?.apiUrlTest || 'Not Set'}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Key className="h-4 w-4" />
                      Production Environment Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Merchant ID</p>
                        <p className="font-mono text-sm">{method.settings?.merchantIdProd || 'Not Set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">API Key</p>
                        <p className="font-mono text-sm">{maskSecret(method.settings?.apiKeyProd)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Encryption Key</p>
                        <p className="font-mono text-sm">{maskSecret(method.settings?.encryptionKeyProd)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">API URL</p>
                        <p className="font-mono text-sm break-all">{method.settings?.apiUrlProd || 'Not Set'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* API Endpoints */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <DollarSign className="h-4 w-4" />
                  Current Active Configuration
                </div>
                <div className="pl-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={method.settings?.isProduction ? 'destructive' : 'secondary'}>
                      {method.settings?.isProduction ? 'Using Production Credentials' : 'Using Test Credentials'}
                    </Badge>
                  </div>
                  {method.type === 'ZainCash' && (
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">Active Merchant ID:</p>
                      <p className="font-mono">
                        {method.settings?.isProduction 
                          ? method.settings?.merchantProd 
                          : method.settings?.merchantTest}
                      </p>
                    </div>
                  )}
                  {method.type === 'QICard' && (
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">Active Terminal ID:</p>
                      <p className="font-mono">
                        {method.settings?.isProduction 
                          ? method.settings?.terminalIdProd 
                          : method.settings?.terminalIdTest}
                      </p>
                    </div>
                  )}
                  {method.type === 'Switch' && (
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">Active Merchant ID:</p>
                      <p className="font-mono">
                        {method.settings?.isProduction 
                          ? method.settings?.merchantIdProd 
                          : method.settings?.merchantIdTest}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!paymentMethods || paymentMethods.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No payment methods configured</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment History Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>View all payment transactions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="text-center py-8 text-muted-foreground">Loading payment history...</div>
          ) : !paymentHistory || paymentHistory.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No payment history found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Gateway Ref</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((log: PaymentLog) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{log.transactionId.substring(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.gateway}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.amount.toLocaleString()} {log.currency}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.gatewayTransactionId || log.referenceId || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                        {log.errorMessage || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
                          ? method.settings?.merchantIdProd 
                          : method.settings?.merchantIdTest}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!paymentMethods || paymentMethods.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No payment methods configured</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
