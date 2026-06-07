import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata.booking_id;

      await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          payment_status: "paid",
          seeker_confirmed_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      // Notify buddy
      const { data: booking } = await supabase
        .from("bookings")
        .select("buddy_id, activity, date")
        .eq("id", bookingId)
        .single();

      if (booking) {
        await supabase.from("notifications").insert({
          user_id: booking.buddy_id,
          type: "booking_confirmed",
          title: "New Booking! 🎉",
          body: `You have a new ${booking.activity} booking on ${booking.date}`,
          data: { booking_id: bookingId },
        });
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata.booking_id;

      await supabase
        .from("bookings")
        .update({ payment_status: "failed", status: "cancelled" })
        .eq("id", bookingId);
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled) {
        await supabase
          .from("profiles")
          .update({ is_verified: true })
          .eq("stripe_connect_account_id", account.id);
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
