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
      <CardContent className="px-2 sm:px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Datum</TableHead>
              <TableHead>Gebruiker</TableHead>
              <TableHead>Bedrag</TableHead>
              <TableHead className="hidden sm:table-cell">Reden</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments?.map((adjustment) => (
              <TableRow key={adjustment.id}>
                <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                  {format(new Date(adjustment.created_at), "dd/MM/yy", {
                    locale: nl,
                  })}
                  <span className="hidden sm:inline">
                    {" "}{format(new Date(adjustment.created_at), "HH:mm", { locale: nl })}
                  </span>
                </TableCell>
                <TableCell className="text-xs sm:text-sm">
                  {adjustment.user?.name}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={adjustment.delta_cents > 0 ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {adjustment.delta_cents > 0 ? "+" : ""}
                    {formatCurrency(adjustment.delta_cents)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell max-w-md">
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
