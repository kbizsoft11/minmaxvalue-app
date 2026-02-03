import ShortId from '@/components/admin/ShortId'
import AdminLayout from '@/components/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import SellerStripeSetup from './SellerStripeSetup'

interface Payout {
    id: string;
    user_id: string;
    amount: number;
    status: string;
    method: string;
    requested_at: string;
    processed_at: string | null;
    completed_at: string | null;
    username: string;
}

const AdminPayouts = () => {
    const [payouts, setPayouts] = useState<Payout[]>([]);

    const matchesSearch = (query: string, ...fields: (string | null | undefined)[]): boolean => {
        if (!query.trim()) return true;
        const lowerQuery = query.toLowerCase().trim();
        return fields.some(field => field?.toLowerCase().includes(lowerQuery));
    };

    const fetchPayouts = async () => {
        const { data } = await supabase
            .from("payouts")
            .select(`
            id,
            user_id,
            amount,
            status,
            method,
            requested_at,
            processed_at,
            completed_at,
            profiles!inner(username)
          `)
            .order("requested_at", { ascending: false })
            .limit(50);

        if (data) {
            setPayouts(
                data.map((p: any) => ({
                    id: p.id,
                    user_id: p.user_id,
                    amount: p.amount,
                    status: p.status,
                    method: p.method,
                    requested_at: p.requested_at,
                    processed_at: p.processed_at,
                    completed_at: p.completed_at,
                    username: p.profiles.username,
                }))
            );
        }
    };

    useEffect(() => {
        fetchPayouts();
    }, []);

    return (
        <AdminLayout>
            <div>
                <SellerStripeSetup />

                <Card className="p-6 mt-6">
                    <h2 className="text-xl font-bold mb-4">Payout Requests</h2>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Seller</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Requested</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payouts.map((payout) => (
                                    <TableRow key={payout.id}>
                                        <TableCell><ShortId id={payout.id} prefix="PAY-" /></TableCell>
                                        <TableCell className="font-medium">{payout.username}</TableCell>
                                        <TableCell>${(payout.amount / 100).toLocaleString()}</TableCell>
                                        <TableCell className="capitalize">{payout.method}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    payout.status === "completed"
                                                        ? "default"
                                                        : payout.status === "pending"
                                                            ? "secondary"
                                                            : "outline"
                                                }
                                            >
                                                {payout.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(payout.requested_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            {payout.status === "pending" && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                    // onClick={() => handlePayoutAction(payout.id, "processing")}
                                                    >
                                                        Process
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                    // onClick={() => handlePayoutAction(payout.id, "completed")}
                                                    >
                                                        Complete
                                                    </Button>
                                                </div>
                                            )}
                                            {payout.status === "processing" && (
                                                <Button
                                                    size="sm"
                                                // onClick={() => handlePayoutAction(payout.id, "completed")}
                                                >
                                                    Complete
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </AdminLayout>
    )
}

export default AdminPayouts