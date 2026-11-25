import { NextRequest } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get("payment_id") || searchParams.get("order_id");

  if (!paymentId) {
    return new Response("Missing payment_id or order_id parameter", { status: 400 });
  }

  const { user, error } = requireAuth(request);
    if (error) return error;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastStatus = "";
      let iterations = 0;
      const maxIterations = 60; // 60 seconds max connection lifecycle

      const interval = setInterval(async () => {
        if (closed || iterations >= maxIterations) {
          clearInterval(interval);
          if (!closed) {
            try {
              controller.close();
            } catch (e) {}
            closed = true;
          }
          return;
        }

        iterations++;

        try {
          const res = callDbBridge("payment_status", [paymentId, user.id]);
          if (res && res.success) {
            const currentStatus = res.status;
            // Send event if status changed or heartbeat every 5 iterations
            if (currentStatus !== lastStatus || iterations % 5 === 0) {
              lastStatus = currentStatus;
              const eventPayload = `data: ${JSON.stringify({
                status: currentStatus,
                payment: res.payment,
                order: res.order,
                appointment: res.appointment,
                timestamp: new Date().toISOString()
              })}\n\n`;
              controller.enqueue(encoder.encode(eventPayload));
            }

            // Terminal statuses
            if (["SUCCESS", "FAILED", "CANCELLED", "REFUNDED"].includes(currentStatus)) {
              clearInterval(interval);
              setTimeout(() => {
                if (!closed) {
                  try {
                    controller.close();
                  } catch (e) {}
                  closed = true;
                }
              }, 1000);
            }
          }
        } catch (err) {
          console.error("Payment stream check error:", err);
        }
      }, 1000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        closed = true;
        try {
          controller.close();
        } catch (e) {}
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
