import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export const AdjustmentHistory = () => {
  const { data: adjustments, isLoading } = useQuery({
    queryKey: ["adjustment-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adjustments")
        .select(`
          *,
          user:profiles!adjustments_user_id_fkey(id, name, email)
        `)
        .not("reason", "ilike", "Foutje teruggedraaid:%")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("nl-BE", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  };

  if (isLoading) {
    return <div>Laden...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldo Aanpassingen Geschiedenis</CardTitle>
        <CardDescription>
          Overzicht van alle manuele saldo aanpassingen door admins
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Gebruiker</TableHead>
              <TableHead>Bedrag</TableHead>
              <TableHead>Reden</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments?.map((adjustment) => (
              <TableRow key={adjustment.id}>
                <TableCell>
                  {format(new Date(adjustment.created_at), "dd MMM yyyy HH:mm", {
                    locale: nl,
                  })}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{adjustment.user?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {adjustment.user?.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={adjustment.delta_cents > 0 ? "default" : "destructive"}
                  >
                    {adjustment.delta_cents > 0 ? "+" : ""}
                    {formatCurrency(adjustment.delta_cents)}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  <span className="text-sm">{adjustment.reason}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
