import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_FROM = Deno.env.get('TWILIO_PHONE_FROM');
const ADMIN_PHONE_NUMBER = Deno.env.get('ADMIN_PHONE_NUMBER');

interface ConsumptionData {
  user_name: string;
  item_name: string;
  price_cents: number;
  created_at: string;
}

const sendSMS = async (to: string, message: string) => {
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_FROM!,
        To: to,
        Body: message,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Twilio API error:', errorText);
    throw new Error(`Twilio API error: ${response.status} ${errorText}`);
  }

  return response.json();
};

const formatCurrency = (cents: number) => {
  return `€${(cents / 100).toFixed(2)}`;
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('nl-BE', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'Europe/Brussels'
  });
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('SMS notification function called');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_FROM || !ADMIN_PHONE_NUMBER) {
      console.error('Missing Twilio configuration');
      return new Response('Missing Twilio configuration', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const { consumption_id } = await req.json();
    console.log('Processing consumption ID:', consumption_id);

    if (!consumption_id) {
      return new Response('Missing consumption_id', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Get consumption details with user and item info
    const { data: consumption, error } = await supabase
      .from('consumptions')
      .select(`
        *,
        profiles!inner(name),
        items!inner(name)
      `)
      .eq('id', consumption_id)
      .single();

    if (error) {
      console.error('Error fetching consumption:', error);
      return new Response('Error fetching consumption', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    if (!consumption) {
      console.log('Consumption not found');
      return new Response('Consumption not found', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    const userName = consumption.profiles.name;
    const itemName = consumption.items.name;
    const price = consumption.price_cents;
    const time = formatTime(consumption.created_at);

    // Skip SMS for late fees (te laat boete)
    if (itemName.toLowerCase().includes('boete') || itemName.toLowerCase().includes('te laat')) {
      console.log('Skipping SMS for late fee:', itemName);
      return new Response('SMS skipped for late fee', { 
        status: 200,
        headers: corsHeaders 
      });
    }

    const message = `🍺 Nieuwe registratie!\n\n👤 ${userName}\n🛒 ${itemName}\n💰 ${formatCurrency(price)}\n⏰ ${time}`;

    console.log('Sending SMS:', message);

    await sendSMS(ADMIN_PHONE_NUMBER, message);

    console.log('SMS sent successfully');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in send-consumption-sms function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});