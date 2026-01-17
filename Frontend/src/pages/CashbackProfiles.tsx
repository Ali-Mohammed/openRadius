import { useState } from 'react';
import { Users, UserCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GroupCashback from '@/components/cashback/GroupCashback';
import UserCashback from '@/components/cashback/UserCashback';

export default function CashbackProfiles() {
  const [activeTab, setActiveTab] = useState('group');

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cashback Management</h1>
          <p className="text-sm text-muted-foreground">
            Configure cashback amounts for billing profiles
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="group" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Cashback by Group
          </TabsTrigger>
          <TabsTrigger value="user" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            Cashback by User
          </TabsTrigger>
        </TabsList>

        <TabsContent value="group" className="mt-4">
          <GroupCashback />
        </TabsContent>

        <TabsContent value="user" className="mt-4">
          <UserCashback />
        </TabsContent>
      </Tabs>
    </div>
  );
}
