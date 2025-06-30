export default async (request, context) => {
  const allowedIPs = [
    '103.217.245.94', 
    '103.148.144.47', 
    '111.235.67.0/24',
    '202.89.70.6'
  ]; // Replace with real IPs
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim();

  if (!allowedIPs.includes(clientIP)) {
    return new Response('Access Denied', { status: 403 });
  }

  return context.next();
};
