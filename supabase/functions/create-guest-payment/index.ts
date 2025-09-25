import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    const { guest_id } = await req.json();
    if (!guest_id) throw new Error("Guest ID required");

    // Initialize Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get guest profile
    const { data: guestProfile, error: profileError } = await supabaseService
      .from("profiles")
      .select("*")
      .eq("id", guest_id)
      .eq("guest_account", true)
      .eq("occupied", true)
      .eq("active", true)
      .single();

    if (profileError || !guestProfile) {
      throw new Error("Guest profile not found or not active");
    }

    // Calculate current balance
    const { data: balance, error: balanceError } = await supabaseService
      .rpc("calculate_user_balance", { user_uuid: guest_id });

    if (balanceError) {
      throw new Error("Failed to calculate balance");
    }

    const currentBalance = balance || 0;
    
    // Only allow payment if balance is negative
    if (currentBalance >= 0) {
      throw new Error("No outstanding balance to pay");
    }

    const amountToPay = Math.abs(currentBalance); // Convert negative balance to positive amount

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: `guest${guestProfile.guest_number}@temp.chiro`,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { 
              name: `Gasttab afrekenen - ${guestProfile.occupied_by_name || guestProfile.name}`,
              description: `Afrekening voor gast #${guestProfile.guest_number}`
            },
            unit_amount: amountToPay,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/guest/${guest_id}`,
    });

    // Record the pending top-up
    const { error: topUpError } = await supabaseService
      .from("top_ups")
      .insert({
        user_id: guest_id,
        amount_cents: amountToPay,
        provider: "stripe",
        provider_ref: session.id,
        status: "pending",
      });

    if (topUpError) {
      throw new Error("Failed to record top-up transaction");
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Guest payment error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});