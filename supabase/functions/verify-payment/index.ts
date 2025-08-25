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
    const { session_id } = await req.json();
    if (!session_id) throw new Error("Session ID required");

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === "paid") {
      // Initialize Supabase service client
      const supabaseService = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Verify the top-up record exists (pending or already paid)
      const { data: topUp, error: fetchError } = await supabaseService
        .from("top_ups")
        .select("*")
        .eq("provider_ref", session_id)
        .single();

      if (fetchError || !topUp) {
        throw new Error("Top-up record not found");
      }

      // If already paid, return success
      if (topUp.status === "paid") {
        return new Response(JSON.stringify({ 
          success: true, 
          amount: session.amount_total 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // If not pending, something is wrong
      if (topUp.status !== "pending") {
        throw new Error("Top-up record has invalid status");
      }

      // Verify the amount matches
      if (session.amount_total !== topUp.amount_cents) {
        throw new Error("Payment amount mismatch");
      }

      // Update the top-up record to paid
      const { error: updateError } = await supabaseService
        .from("top_ups")
        .update({ 
          status: "paid",
          updated_at: new Date().toISOString()
        })
        .eq("provider_ref", session_id);

      if (updateError) {
        throw new Error("Failed to update top-up status");
      }

      return new Response(JSON.stringify({ 
        success: true, 
        amount: session.amount_total 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      status: session.payment_status 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});