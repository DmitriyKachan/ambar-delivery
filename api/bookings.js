let inMemoryBookings = [];

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
    return res.status(200).json(inMemoryBookings);
  }

  if (method === "POST") {
    const newBooking = typeof body === "string" ? JSON.parse(body) : body;
    const existingIdx = inMemoryBookings.findIndex(b => b.id === newBooking.id);
    if (existingIdx >= 0) {
      inMemoryBookings[existingIdx] = { ...inMemoryBookings[existingIdx], ...newBooking };
    } else {
      inMemoryBookings.unshift(newBooking);
    }
    inMemoryBookings = inMemoryBookings.slice(0, 300);
    return res.status(200).json({ success: true, booking: newBooking });
  }

  if (method === "PUT" || method === "PATCH") {
    const updateData = typeof body === "string" ? JSON.parse(body) : body;
    const idx = inMemoryBookings.findIndex(b => b.id === updateData.id);
    if (idx >= 0) {
      inMemoryBookings[idx] = { ...inMemoryBookings[idx], ...updateData };
    } else {
      inMemoryBookings.unshift(updateData);
    }
    return res.status(200).json({ success: true, booking: idx >= 0 ? inMemoryBookings[idx] : updateData });
  }

  if (method === "DELETE") {
    if (isResetAll) {
      inMemoryBookings = [];
      return res.status(200).json({ success: true, message: "All bookings cleared" });
    }
    const { id } = body;
    inMemoryBookings = inMemoryBookings.filter(b => b.id !== id);
    return res.status(200).json({ success: true });
  }

  return res.status(405).send("Method not allowed");
}
