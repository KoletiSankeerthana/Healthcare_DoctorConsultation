/**
 * Payment Configuration & Safety Guard System
 * MediVerse Healthcare Telemedicine Platform
 *
 * Provides server-side payment mode configuration, safety validation,
 * and test mock transaction generation.
 */

export type PaymentMode = "mock" | "razorpay";

/**
 * Returns the currently active payment mode with strict production safety enforcement.
 * Mock mode is NEVER permitted in a production environment.
 */
export function getPaymentMode(): PaymentMode {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.ENVIRONMENT === "production" ||
    process.env.VERCEL_ENV === "production";

  const configuredMode = (process.env.PAYMENT_MODE || "mock").toLowerCase().trim();

  // Safety Requirement: Reject mock payments in production
  if (isProduction) {
    if (configuredMode === "mock") {
      console.warn(
        "[SECURITY ALERT] PAYMENT_MODE=mock is strictly prohibited in production. Forcing real 'razorpay' mode."
      );
    }
    return "razorpay";
  }

  return configuredMode === "razorpay" ? "razorpay" : "mock";
}

/**
 * Generates a unique dummy transaction ID formatted as TEST-PAY-XXXXXXXX
 */
export function generateDummyTransactionId(): string {
  const randomChars = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `TEST-PAY-${randomChars}`;
}
