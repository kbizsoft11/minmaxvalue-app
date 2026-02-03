import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

export default function AdminRoute({ children }: { children: JSX.Element }) {
    const [loading, setLoading] = useState<boolean>(true);
    const [redirect, setRedirect] = useState<null | string>(null);

    useEffect(() => {
        const check = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setRedirect("/auth");
                setLoading(false);
                return;
            }

            const { data: isAdmin, error } = await supabase.rpc(
                "current_user_is_admin"
            );

            if (error || !isAdmin) {
                toast({
                    title: "Access denied",
                    description: "You don't have permission to access this page.",
                    variant: "destructive",
                });
                setRedirect("/");
                setLoading(false);
                return;
            }

            setRedirect(null);
            setLoading(false);
        };

        check();
    }, []);

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            </div>
        );
    }

    if (redirect) return <Navigate to={redirect} replace />;

    return children;
}
