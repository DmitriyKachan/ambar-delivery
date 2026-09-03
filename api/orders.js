let inMemoryOrders = [];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { method, query } = req;
  const body = req.body || {};
  const isResetAll = (query && query.all === "true") || (body && body.all === true);

  if (method === "GET") {
    return res.status(200).json(inMemoryOrders);
  }

  if (method === "POST") {
    const newOrder = typeof body === "string" ? JSON.parse(body) : body;
    const existingIdx = inMemoryOrders.findIndex(o => o.id === newOrder.id);
    if (existingIdx >= 0) {
      inMemoryOrders[existingIdx] = { ...inMemoryOrders[existingIdx], ...newOrder };
    } else {
      inMemoryOrders.unshift(newOrder);
    }
    inMemoryOrders = inMemoryOrders.slice(0, 300);
    return res.status(200).json({ success: true, order: newOrder });
  }

  if (method === "PUT" || method === "PATCH") {
    const updateData = typeof body === "string" ? JSON.parse(body) : body;
    const idx = inMemoryOrders.findIndex(o => o.id === updateData.id);
    if (idx >= 0) {
      inMemoryOrders[idx] = { ...inMemoryOrders[idx], ...updateData };
    } else {
      inMemoryOrders.unshift(updateData);
    }
    return res.status(200).json({ success: true, order: idx >= 0 ? inMemoryOrders[idx] : updateData });
  }

  if (method === "DELETE") {
    if (isResetAll) {
      inMemoryOrders = [];
      return res.status(200).json({ success: true, message: "All orders cleared" });
    }
    const { id } = body;
    inMemoryOrders = inMemoryOrders.filter(o => o.id !== id);
    return res.status(200).json({ success: true });
  }

  return res.status(405).send("Method not allowed");
}
