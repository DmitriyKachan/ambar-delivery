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
    const store = getStore("ambar_restaurant_v3");
    const url = new URL(req.url);
    const queryPhone = url.searchParams.get("phone") || "";
    const isResetAll = url.searchParams.get("all") === "true";

    if (method === "GET") {
      if (!queryPhone) {
        let users = [];
        try {
          const raw = await store.get("users_index", { type: "json" });
          if (Array.isArray(raw)) users = raw;
        } catch (e) {
          users = [];
        }
        return new Response(JSON.stringify(users), { headers: corsHeaders });
      }

      const cleanPhone = queryPhone.replace(/\D/g, "");
      if (cleanPhone.length < 9) {
        return new Response(JSON.stringify({ error: "Invalid phone number" }), { status: 400, headers: corsHeaders });
      }

      const matchKey = cleanPhone.slice(-9);
      let userData = null;
      try {
        userData = await store.get(`user_${matchKey}`, { type: "json" });
      } catch (e) {}

      if (!userData) {
        userData = {
          phone: queryPhone,
          name: "",
          bonuses: 0,
          address: "",
          entrance: "",
          floor: "",
          apt: "",
          orderIds: [],
          bookingIds: [],
          updatedAt: Date.now()
        };
      }

      return new Response(JSON.stringify(userData), { headers: corsHeaders });
    }

    if (method === "POST" || method === "PUT") {
      const payload = await req.json();
      const rawPhone = payload.phone || queryPhone || "";
      const cleanPhone = rawPhone.replace(/\D/g, "");

      if (cleanPhone.length < 9) {
        return new Response(JSON.stringify({ error: "Invalid phone number" }), { status: 400, headers: corsHeaders });
      }

      const matchKey = cleanPhone.slice(-9);
      let existing = {};
      try {
        const raw = await store.get(`user_${matchKey}`, { type: "json" });
        if (raw && typeof raw === "object") existing = raw;
      } catch (e) {}

      const updatedUser = {
        phone: rawPhone || existing.phone || "",
        name: payload.name !== undefined ? payload.name : (existing.name || ""),
        bonuses: typeof payload.bonuses === "number" ? payload.bonuses : (existing.bonuses || 0),
        address: payload.address !== undefined ? payload.address : (existing.address || ""),
        entrance: payload.entrance !== undefined ? payload.entrance : (existing.entrance || ""),
        floor: payload.floor !== undefined ? payload.floor : (existing.floor || ""),
        apt: payload.apt !== undefined ? payload.apt : (existing.apt || ""),
        orderIds: Array.isArray(payload.orderIds) ? payload.orderIds : (existing.orderIds || []),
        bookingIds: Array.isArray(payload.bookingIds) ? payload.bookingIds : (existing.bookingIds || []),
        updatedAt: Date.now()
      };

      await store.setJSON(`user_${matchKey}`, updatedUser);

      try {
        let usersIndex = [];
        const rawIndex = await store.get("users_index", { type: "json" });
        if (Array.isArray(rawIndex)) usersIndex = rawIndex;
        const idx = usersIndex.findIndex(u => (u.phone || "").replace(/\D/g, "").slice(-9) === matchKey);
        if (idx >= 0) {
          usersIndex[idx] = { phone: updatedUser.phone, name: updatedUser.name, bonuses: updatedUser.bonuses, updatedAt: updatedUser.updatedAt };
        } else {
          usersIndex.push({ phone: updatedUser.phone, name: updatedUser.name, bonuses: updatedUser.bonuses, updatedAt: updatedUser.updatedAt });
        }
        await store.setJSON("users_index", usersIndex.slice(0, 500));
      } catch(e) {}

      return new Response(JSON.stringify({ success: true, user: updatedUser }), { headers: corsHeaders });
    }

    if (method === "DELETE") {
      if (isResetAll) {
        await store.setJSON("users_index", []);
        return new Response(JSON.stringify({ success: true, message: "All users reset" }), { headers: corsHeaders });
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
};
