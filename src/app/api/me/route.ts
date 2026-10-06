import { getApiUser, json, unauthorized } from "@/lib/api";
import { lastDeliveryDetails } from "@/lib/checkout";

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const last = await lastDeliveryDetails(user.email);
  return json({
    user,
    delivery: {
      name: last?.customer_name ?? user.name ?? "",
      phone: last?.phone ?? "",
      address: last?.address ?? "",
      city: last?.city ?? "",
    },
  });
}
