import { handlePaymongoWebhook } from "@/lib/payment/paymongoWebhookHandler";

export async function POST(request: Request) {
  return handlePaymongoWebhook(request);
}