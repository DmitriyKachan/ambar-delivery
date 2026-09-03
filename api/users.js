let inMemoryUsers = {};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { method, query } = req;
  const body = req.body || {};
  const queryPhone = query ? (query.phone || "") : "";
  const isResetAll = (query && query.all === "true") || (body && body.all === true);

  if (method === "GET") {
    if (!queryPhone) {
      const usersList = Object.values(inMemoryUsers);
      return res.status(200).json(usersList);
    }

    const cleanPhone = queryPhone.replace(/\D/g, "");
    const matchKey = cleanPhone.slice(-9);
    const user = inMemoryUsers[matchKey] || {
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
    return res.status(200).json(user);
  }

  if (method === "POST" || method === "PUT") {
    const payload = typeof body === "string" ? JSON.parse(body) : body;
    const rawPhone = payload.phone || queryPhone || "";
    const cleanPhone = rawPhone.replace(/\D/g, "");

    if (cleanPhone.length < 9) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const matchKey = cleanPhone.slice(-9);
    const existing = inMemoryUsers[matchKey] || {};

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

    inMemoryUsers[matchKey] = updatedUser;
    return res.status(200).json({ success: true, user: updatedUser });
  }

  if (method === "DELETE") {
    if (isResetAll) {
      inMemoryUsers = {};
      return res.status(200).json({ success: true, message: "All users reset" });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).send("Method not allowed");
}
