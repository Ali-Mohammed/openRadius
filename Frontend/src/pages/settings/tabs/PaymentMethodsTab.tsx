import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Coins, Plus, Trash2, Edit2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { paymentMethodApi, type PaymentMethod, type PaymentMethodSettings, type CreatePaymentMethodDto, type UpdatePaymentMethodDto } from '@/api/paymentMethodApi'
import { formatApiError } from '@/utils/errorHandler'

export default function PaymentMethodsTab() {
  const queryClient = useQueryClient()
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null)
  const [paymentType, setPaymentType] = useState<'ZainCash' | 'QICard' | 'Switch'>('ZainCash')
  const [paymentSettings, setPaymentSettings] = useState<PaymentMethodSettings>({})

  // Fetch payment methods
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodApi.getAll(),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (dto: CreatePaymentMethodDto) => paymentMethodApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      toast.success('Payment method added successfully')
      setShowPaymentDialog(false)
      setEditingPayment(null)
      setPaymentSettings({})
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdatePaymentMethodDto }) =>
      paymentMethodApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      toast.success('Payment method updated successfully')
      setShowPaymentDialog(false)
      setEditingPayment(null)
      setPaymentSettings({})
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => paymentMethodApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      toast.success('Payment method deleted successfully')
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  const handleSavePayment = () => {
    if (editingPayment && editingPayment.id) {
      // Update existing payment method
      const dto: UpdatePaymentMethodDto = {
        name: paymentType,
        isActive: paymentSettings.isActive !== undefined ? paymentSettings.isActive : true,
        settings: paymentSettings
      }
      updateMutation.mutate({ id: editingPayment.id, dto })
    } else {
      // Create new payment method
      const dto: CreatePaymentMethodDto = {
        type: paymentType,
        name: paymentType,
        isActive: paymentSettings.isActive !== undefined ? paymentSettings.isActive : true,
        settings: paymentSettings
      }
      createMutation.mutate(dto)
    }
  }

  const handleDeletePayment = (id: number | undefined) => {
    if (id && confirm('Are you sure you want to delete this payment method?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Payment Methods
              </CardTitle>
              <CardDescription>
                Configure payment gateways for your workspace
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => alert('Test button clicked!')}>
                Test
              </Button>
              <Button onClick={() => {
                setEditingPayment(null)
                setPaymentType('ZainCash')
                setPaymentSettings({})
                setShowPaymentDialog(true)
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Coins className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No payment methods configured</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                Add your first payment method to start accepting payments
              </p>
              <Button onClick={() => {
                setEditingPayment(null)
                setPaymentType('ZainCash')
                setPaymentSettings({})
                setShowPaymentDialog(true)
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-primary/10 p-3">
                      <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{method.name}</span>
                        <Badge variant={method.isActive ? "default" : "secondary"}>
                          {method.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {method.settings.isProduction !== undefined && (
                          <Badge variant="outline">
                            {method.settings.isProduction ? 'Production' : 'Test'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {method.type === 'ZainCash' && `Merchant: ${method.settings.isProduction ? method.settings.merchantProd : method.settings.merchantTest || 'Not set'}`}
                        {method.type === 'QICard' && `Terminal: ${method.settings.isProduction ? method.settings.terminalIdProd : method.settings.terminalIdTest || 'Not set'}`}
                        {method.type === 'Switch' && `Entity: ${method.settings.isProduction ? method.settings.entityIdProd : method.settings.entityIdTest || 'Not set'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingPayment(method)
                        setPaymentType(method.type)
                        setPaymentSettings(method.settings)
                        setShowPaymentDialog(true)
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePayment(method.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingPayment ? 'Edit' : 'Add'} Payment Method</DialogTitle>
            <DialogDescription>
              Configure payment method settings for your workspace
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select 
                value={paymentType} 
                onValueChange={(value: 'ZainCash' | 'QICard' | 'Switch') => {
                  setPaymentType(value)
                  setPaymentSettings({})
                }}
                disabled={!!editingPayment}
              >
                <SelectTrigger className="border">
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZainCash">ZainCash</SelectItem>
                  <SelectItem value="QICard">QI Card</SelectItem>
                  <SelectItem value="Switch">Switch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ZainCash Settings */}
            {paymentType === 'ZainCash' && (
              <>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Select 
                    value={paymentSettings.isProduction === undefined ? '' : (paymentSettings.isProduction ? 'production' : 'test')}
                    onValueChange={(value) => {
                      const isProduction = value === 'production'
                      if (!isProduction && !paymentSettings.msisdnTest) {
                        setPaymentSettings({ 
                          ...paymentSettings, 
                          isProduction,
                          msisdnTest: '9647835077893',
                          merchantTest: '5ffacf6612b5777c6d44266f',
                          secretTest: 'test_secret_key',
                          langTest: 'ar'
                        })
                      } else {
                        setPaymentSettings({ ...paymentSettings, isProduction })
                      }
                    }}
                  >
                    <SelectTrigger className="border">
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">Production</SelectItem>
                      <SelectItem value="test">Test/Sandbox</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentSettings.isProduction !== undefined && (
                  <>
                    <div className="space-y-2">
                      <Label>MSISDN</Label>
                      <Input
                        value={paymentSettings.isProduction ? (paymentSettings.msisdnProd || '') : (paymentSettings.msisdnTest || '')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'msisdnProd' : 'msisdnTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "964XXXXXXXXXX" : "9647835077893"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Merchant ID</Label>
                      <Input
                        value={paymentSettings.isProduction ? (paymentSettings.merchantProd || '') : (paymentSettings.merchantTest || '')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'merchantProd' : 'merchantTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "your_merchant_id_here" : "5ffacf6612b5777c6d44266f"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Secret</Label>
                      <Input
                        type="password"
                        value={paymentSettings.isProduction ? (paymentSettings.secretProd || '') : (paymentSettings.secretTest || '')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'secretProd' : 'secretTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "Production Secret" : "Test Secret"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select
                        value={paymentSettings.isProduction ? (paymentSettings.langProd || 'ar') : (paymentSettings.langTest || 'ar')}
                        onValueChange={(value) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'langProd' : 'langTest']: value 
                        })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ar">Arabic (ar)</SelectItem>
                          <SelectItem value="en">English (en)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Token</Label>
                      <Input
                        type="password"
                        value={paymentSettings.token || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, token: e.target.value })}
                        placeholder="Enter Token"
                      />
                      <p className="text-xs text-muted-foreground">This token is used for both production and test environments</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Frontend Callback URL</Label>
                      <Input
                        value={paymentSettings.frontendCallbackUrl || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, frontendCallbackUrl: e.target.value })}
                        placeholder="https://your-domain.com/payment/success"
                      />
                      <p className="text-xs text-muted-foreground">URL to redirect users after payment completion</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Backend Callback URL</Label>
                      <Input
                        value={paymentSettings.backendCallbackUrl || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, backendCallbackUrl: e.target.value })}
                        placeholder="https://your-api.com/webhooks/payment"
                      />
                      <p className="text-xs text-muted-foreground">URL to receive payment notifications on your backend</p>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="zaincash-active"
                        checked={paymentSettings.isActive || false}
                        onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, isActive: checked === true })}
                      />
                      <Label htmlFor="zaincash-active" className="text-sm font-normal cursor-pointer">
                        Enable this payment method
                      </Label>
                    </div>
                  </>
                )}
              </>
            )}

            {/* QICard Settings */}
            {paymentType === 'QICard' && (
              <>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Select 
                    value={paymentSettings.isProduction === undefined ? '' : (paymentSettings.isProduction ? 'production' : 'test')}
                    onValueChange={(value) => {
                      const isProduction = value === 'production'
                      if (!isProduction && !paymentSettings.usernameTest) {
                        setPaymentSettings({ 
                          ...paymentSettings, 
                          isProduction,
                          usernameTest: 'paymentgatewaytest',
                          passwordTest: 'test_password_123',
                          terminalIdTest: '237984',
                          currencyTest: 'IQD',
                          urlTest: 'https://uat-sandbox-3ds-api.qi.iq/api/v1'
                        })
                      } else {
                        setPaymentSettings({ ...paymentSettings, isProduction })
                      }
                    }}
                  >
                    <SelectTrigger className="border"><SelectValue placeholder="Select environment" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">Production</SelectItem>
                      <SelectItem value="test">Test/Sandbox</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentSettings.isProduction !== undefined && (
                  <>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={paymentSettings.isProduction ? (paymentSettings.usernameProd || '') : (paymentSettings.usernameTest || '')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'usernameProd' : 'usernameTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "your_username" : "paymentgatewaytest"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={paymentSettings.isProduction ? (paymentSettings.passwordProd || '') : (paymentSettings.passwordTest || '')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'passwordProd' : 'passwordTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "Production Password" : "Test Password"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Terminal ID</Label>
                      <Input
                        value={paymentSettings.isProduction ? (paymentSettings.terminalIdProd || '') : (paymentSettings.terminalIdTest || '')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'terminalIdProd' : 'terminalIdTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "your_terminal_id" : "237984"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Input
                        value={paymentSettings.isProduction ? (paymentSettings.currencyProd || 'IQD') : (paymentSettings.currencyTest || 'IQD')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'currencyProd' : 'currencyTest']: e.target.value 
                        })}
                        placeholder="IQD"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>API URL</Label>
                      <Input
                        value={paymentSettings.isProduction ? (paymentSettings.urlProd || '') : (paymentSettings.urlTest || '')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'urlProd' : 'urlTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "https://3ds-api.qi.iq/api/v1" : "https://uat-sandbox-3ds-api.qi.iq/api/v1"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Frontend Callback URL</Label>
                      <Input
                        value={paymentSettings.frontendCallbackUrl || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, frontendCallbackUrl: e.target.value })}
                        placeholder="https://your-domain.com/payment/success"
                      />
                      <p className="text-xs text-muted-foreground">URL to redirect users after payment completion</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Backend Callback URL</Label>
                      <Input
                        value={paymentSettings.backendCallbackUrl || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, backendCallbackUrl: e.target.value })}
                        placeholder="https://your-api.com/webhooks/payment"
                      />
                      <p className="text-xs text-muted-foreground">URL to receive payment notifications on your backend</p>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="qicard-active"
                        checked={paymentSettings.isActive || false}
                        onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, isActive: checked === true })}
                      />
                      <Label htmlFor="qicard-active" className="text-sm font-normal cursor-pointer">
                        Enable this payment method
                      </Label>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Switch Settings */}
            {paymentType === 'Switch' && (
              <>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Select 
                    value={paymentSettings.isProduction === undefined ? '' : (paymentSettings.isProduction ? 'production' : 'test')}
                    onValueChange={(value) => {
                      const isProduction = value === 'production'
                      if (!isProduction && !paymentSettings.entityIdTest) {
                        setPaymentSettings({ 
                          ...paymentSettings, 
                          isProduction,
                          entityIdTest: '8a8294174d0595bb014d05d829cb01cd',
                          entityAuthTest: 'test_auth_token_123',
                          currencyTest: 'USD',
                          entityUrlTest: 'https://eu-test.oppwa.com/v1/checkouts'
                        })
                      } else {
                        setPaymentSettings({ ...paymentSettings, isProduction })
                      }
                    }}
                  >
                    <SelectTrigger className="border"><SelectValue placeholder="Select environment" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">Production</SelectItem>
                      <SelectItem value="test">Test/Sandbox</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentSettings.isProduction !== undefined && (
                  <>
                    <div className="space-y-2">
                      <Label>Entity ID</Label>
                      <Input
                        value={paymentSettings.isProduction ? (paymentSettings.entityIdProd || '') : (paymentSettings.entityIdTest || '')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'entityIdProd' : 'entityIdTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "your_entity_id_here" : "8a8294174d0595bb014d05d829cb01cd"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Entity Auth</Label>
                      <Input
                        type="password"
                        value={paymentSettings.isProduction ? (paymentSettings.entityAuthProd || '') : (paymentSettings.entityAuthTest || '')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'entityAuthProd' : 'entityAuthTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "Production Auth Token" : "Test Auth Token"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Input
                        value={paymentSettings.isProduction ? (paymentSettings.currencyProd || 'IQD') : (paymentSettings.currencyTest || 'USD')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'currencyProd' : 'currencyTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "IQD" : "USD"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Entity URL</Label>
                      <Input
                        value={paymentSettings.isProduction ? (paymentSettings.entityUrlProd || '') : (paymentSettings.entityUrlTest || '')}
                        onChange={(e) => setPaymentSettings({ 
                          ...paymentSettings, 
                          [paymentSettings.isProduction ? 'entityUrlProd' : 'entityUrlTest']: e.target.value 
                        })}
                        placeholder={paymentSettings.isProduction ? "https://eu-prod.oppwa.com/v1/checkouts" : "https://eu-test.oppwa.com/v1/checkouts"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Decode Key</Label>
                      <Input
                        type="password"
                        value={paymentSettings.decodeKey || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, decodeKey: e.target.value })}
                        placeholder="Enter Decode Key"
                      />
                      <p className="text-xs text-muted-foreground">This key is used for both production and test environments</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Frontend Callback URL</Label>
                      <Input
                        value={paymentSettings.frontendCallbackUrl || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, frontendCallbackUrl: e.target.value })}
                        placeholder="https://your-domain.com/payment/success"
                      />
                      <p className="text-xs text-muted-foreground">URL to redirect users after payment completion</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Backend Callback URL</Label>
                      <Input
                        value={paymentSettings.backendCallbackUrl || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, backendCallbackUrl: e.target.value })}
                        placeholder="https://your-api.com/webhooks/payment"
                      />
                      <p className="text-xs text-muted-foreground">URL to receive payment notifications on your backend</p>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="switch-active"
                        checked={paymentSettings.isActive || false}
                        onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, isActive: checked === true })}
                      />
                      <Label htmlFor="switch-active" className="text-sm font-normal cursor-pointer">
                        Enable this payment method
                      </Label>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowPaymentDialog(false)
              setEditingPayment(null)
              setPaymentSettings({})
            }}>
              Cancel
            </Button>
            <Button onClick={handleSavePayment}>
              {editingPayment ? 'Update' : 'Add'} Payment Method
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
