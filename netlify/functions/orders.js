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
    const store = getStore("ambar_restaurant_data");

    if (method === "GET") {
      let orders = [];
      try {
        const raw = await store.get("orders", { type: "json" });
        if (Array.isArray(raw)) orders = raw;
      } catch (e) {
        orders = [];
      }
      return new Response(JSON.stringify(orders), { headers: corsHeaders });
    }

    if (method === "POST") {
      const newOrder = await req.json();
      let orders = [];
      try {
        const raw = await store.get("orders", { type: "json" });
        if (Array.isArray(raw)) orders = raw;
      } catch (e) {
        orders = [];
      }

      const existingIdx = orders.findIndex(o => o.id === newOrder.id);
      if (existingIdx >= 0) {
        orders[existingIdx] = { ...orders[existingIdx], ...newOrder };
      } else {
        orders.unshift(newOrder);
      }

      // Store up to 250 recent orders
      const trimmed = orders.slice(0, 250);
      await store.setJSON("orders", trimmed);

      return new Response(JSON.stringify({ success: true, order: newOrder }), {
        headers: corsHeaders
      });
    }

    if (method === "PUT" || method === "PATCH") {
      const updateData = await req.json();
      let orders = [];
      try {
        const raw = await store.get("orders", { type: "json" });
        if (Array.isArray(raw)) orders = raw;
      } catch (e) {
        orders = [];
      }

      const idx = orders.findIndex(o => o.id === updateData.id);
      if (idx >= 0) {
        orders[idx] = { ...orders[idx], ...updateData };
      } else {
        orders.unshift(updateData);
      }
      await store.setJSON("orders", orders.slice(0, 250));

      return new Response(JSON.stringify({ success: true, order: idx >= 0 ? orders[idx] : updateData }), {
        headers: corsHeaders
      });
    }

    if (method === "DELETE") {
      const { id } = await req.json();
      let orders = [];
      try {
        const raw = await store.get("orders", { type: "json" });
        if (Array.isArray(raw)) orders = raw;
      } catch (e) {
        orders = [];
      }

      orders = orders.filter(o => o.id !== id);
      await store.setJSON("orders", orders);

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
