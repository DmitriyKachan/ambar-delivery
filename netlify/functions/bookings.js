import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const method = req.method;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const store = getStore("ambar_restaurant_v2");
    const url = new URL(req.url);
    const isResetAll = url.searchParams.get("all") === "true";

    if (method === "GET") {
      let bookings = [];
      try {
        const raw = await store.get("bookings", { type: "json" });
        if (Array.isArray(raw)) bookings = raw;
      } catch (e) {
        bookings = [];
      }
      return new Response(JSON.stringify(bookings), { headers: corsHeaders });
    }

    if (method === "POST") {
      const newBooking = await req.json();
      let bookings = [];
      try {
        const raw = await store.get("bookings", { type: "json" });
        if (Array.isArray(raw)) bookings = raw;
      } catch (e) {
        bookings = [];
      }

      const existingIdx = bookings.findIndex(b => b.id === newBooking.id);
      if (existingIdx >= 0) {
        bookings[existingIdx] = { ...bookings[existingIdx], ...newBooking };
      } else {
        bookings.unshift(newBooking);
      }

      const trimmed = bookings.slice(0, 300);
      await store.setJSON("bookings", trimmed);

      return new Response(JSON.stringify({ success: true, booking: newBooking }), {
        headers: corsHeaders
      });
    }

    if (method === "PUT" || method === "PATCH") {
      const updateData = await req.json();
      let bookings = [];
      try {
        const raw = await store.get("bookings", { type: "json" });
        if (Array.isArray(raw)) bookings = raw;
      } catch (e) {
        bookings = [];
      }

      const idx = bookings.findIndex(b => b.id === updateData.id);
      if (idx >= 0) {
        bookings[idx] = { ...bookings[idx], ...updateData };
      } else {
        bookings.unshift(updateData);
      }
      await store.setJSON("bookings", bookings.slice(0, 300));

      return new Response(JSON.stringify({ success: true, booking: idx >= 0 ? bookings[idx] : updateData }), {
        headers: corsHeaders
      });
    }

    if (method === "DELETE") {
      if (isResetAll) {
        await store.setJSON("bookings", []);
        return new Response(JSON.stringify({ success: true, message: "All bookings cleared" }), {
          headers: corsHeaders
        });
      }

      const body = await req.json().catch(() => ({}));
      if (body.all) {
        await store.setJSON("bookings", []);
        return new Response(JSON.stringify({ success: true, message: "All bookings cleared" }), {
          headers: corsHeaders
        });
      }

      const { id } = body;
      let bookings = [];
      try {
        const raw = await store.get("bookings", { type: "json" });
        if (Array.isArray(raw)) bookings = raw;
      } catch (e) {
        bookings = [];
      }

      bookings = bookings.filter(b => b.id !== id);
      await store.setJSON("bookings", bookings);

      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
};
