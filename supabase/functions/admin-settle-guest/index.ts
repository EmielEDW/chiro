import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      throw new Error("Admin access required");
    }

    const { guest_id, method } = await req.json();
    if (!guest_id) throw new Error("Guest ID required");
    if (!method || !['cash', 'adjustment'].includes(method)) {
      throw new Error("Valid settlement method required (cash or adjustment)");
    }

    // Initialize Supabase service client for database operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get guest profile
    const { data: guestProfile, error: profileGuestError } = await supabaseService
      .from("profiles")
      .select("*")
      .eq("id", guest_id)
      .eq("guest_account", true)
      .single();

    if (profileGuestError || !guestProfile) {
      throw new Error("Guest profile not found");
    }

    // Calculate current balance
    const { data: balance, error: balanceError } = await supabaseService
      .rpc("calculate_user_balance", { user_uuid: guest_id });

    if (balanceError) {
      throw new Error("Failed to calculate balance");
    }

    const currentBalance = balance || 0;
    
    // Only settle if there's a negative balance
    if (currentBalance >= 0) {
      throw new Error("No outstanding balance to settle");
    }

    const amountToSettle = Math.abs(currentBalance);

    if (method === 'cash') {
      // Record cash top-up
      const { error: topUpError } = await supabaseService
        .from("top_ups")
        .insert({
          user_id: guest_id,
          amount_cents: amountToSettle,
          provider: "cash",
          provider_ref: `cash_${Date.now()}`,
          status: "paid",
        });

      if (topUpError) {
        throw new Error("Failed to record cash settlement");
      }
    } else {
      // Record adjustment
      const { error: adjustmentError } = await supabaseService
        .from("adjustments")
        .insert({
          user_id: guest_id,
          delta_cents: amountToSettle,
          reason: `Admin settlement - cash payment for guest ${guestProfile.occupied_by_name || guestProfile.name}`,
          created_by: userData.user.id,
        });

      if (adjustmentError) {
        throw new Error("Failed to record adjustment");
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      settled_amount: amountToSettle,
      method: method 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Admin settle guest error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});