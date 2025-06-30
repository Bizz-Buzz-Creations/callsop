const isIpAllowed = (ip, allowedList) => {
  for (const allowed of allowedList) {
    if (allowed.includes("/")) {
      const [range, subnet] = allowed.split("/");
      const ipParts = ip.split(".").map(Number);
      const rangeParts = range.split(".").map(Number);
      const mask = ~(2 ** (32 - Number(subnet)) - 1);

      const ipInt = ipParts.reduce((acc, octet) => (acc << 8) + octet, 0);
      const rangeInt = rangeParts.reduce((acc, octet) => (acc << 8) + octet, 0);

      if ((ipInt & mask) === (rangeInt & mask)) {
        return true;
      }
    } else if (ip === allowed) {
      return true;
    }
  }
  return false;
};

export default async (request, context) => {
  const allowedIPs = [
    "103.217.245.94",
    "103.148.144.47",
    "111.235.67.0/24",
    "202.89.70.6",
  ];

  const clientIP = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  console.log("Client IP:", clientIP);

  if (!clientIP || !isIpAllowed(clientIP, allowedIPs)) {
    return new Response("Access Denied", { status: 403 });
  }

  return context.next();
};
