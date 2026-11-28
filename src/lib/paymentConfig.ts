/**
 * Payment Configuration & Safety Guard System
 * Healvia Healthcare Telemedicine Platform
 *
 * Provides server-side payment mode configuration, safety validation,
 * and test mock transaction generation for Cashfree Payments.
 */

export type PaymentMode = "mock" | "cashfree";

/**
 * Returns the currently active payment mode with strict production safety enforcement.
 * Mock mode is NEVER permitted in a production environment.
 */
export function getPaymentMode(): PaymentMode {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.ENVIRONMENT === "production" ||
    process.env.VERCEL_ENV === "production";

  const configuredMode = (process.env.PAYMENT_MODE || "cashfree").toLowerCase().trim();

  // Safety Requirement: Reject mock payments in production
  if (isProduction) {
    if (configuredMode === "mock") {
      console.warn(
        "[SECURITY ALERT] PAYMENT_MODE=mock is strictly prohibited in production. Forcing real 'cashfree' mode."
      );
    }
    return "cashfree";
  }

  return configuredMode === "mock" ? "mock" : "cashfree";
}

/**
 * Generates a unique dummy transaction ID formatted as TEST-PAY-XXXXXXXX
 */
export function generateDummyTransactionId(): string {
  const randomChars = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `TEST-PAY-${randomChars}`;
}
