/**
 * Client-Side Cashfree Checkout SDK Integration Helper
 * Healvia Healthcare Telemedicine Platform
 *
 * Provides resilient Cashfree Web SDK (v3) loading from official CDN,
 * modal checkout invocation, sandbox/production switching, and structured response handling.
 */

export interface CashfreeCheckoutOptions {
  paymentSessionId: string;
  environment?: "sandbox" | "production";
  redirectTarget?: "_modal" | "_self";
  onSuccess?: (response: any) => void;
  onFailure?: (error: any) => void;
}

export interface CashfreeOpenResult {
  success: boolean;
  status: "COMPLETED" | "FAILED" | "CANCELLED" | "SDK_UNAVAILABLE";
  error?: string;
  paymentDetails?: any;
}

/**
 * Loads the official Cashfree Checkout SDK from CDN with timeout and deduplication.
 */
export function loadCashfreeScript(timeoutMs: number = 8000): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  // If Cashfree constructor is already available on window
  if ((window as any).Cashfree) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };

    const existingScript = document.getElementById("cashfree-checkout-sdk") as HTMLScriptElement;
    if (existingScript) {
      if ((window as any).Cashfree) {
        return resolve(true);
      }
      existingScript.addEventListener("load", () => {
        cleanup();
        resolve(Boolean((window as any).Cashfree));
      });
      existingScript.addEventListener("error", () => {
        cleanup();
        resolve(false);
      });
      timeoutHandle = setTimeout(() => {
        cleanup();
        resolve(Boolean((window as any).Cashfree));
      }, timeoutMs);
      return;
    }

    const script = document.createElement("script");
    script.id = "cashfree-checkout-sdk";
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;

    script.onload = () => {
      cleanup();
      console.info("[Cashfree] Official Web SDK loaded from CDN successfully.");
      resolve(Boolean((window as any).Cashfree));
    };

    script.onerror = () => {
      cleanup();
      console.warn("[Cashfree] Failed to load official Cashfree SDK from CDN.");
      resolve(false);
    };

    timeoutHandle = setTimeout(() => {
      cleanup();
      console.warn(`[Cashfree] Script loading timed out after ${timeoutMs}ms.`);
      resolve(Boolean((window as any).Cashfree));
    }, timeoutMs);

    document.body.appendChild(script);
  });
}

/**
 * Initializes and opens the Cashfree Checkout modal or redirect target.
 */
export async function openCashfreeCheckout(
  options: CashfreeCheckoutOptions
): Promise<CashfreeOpenResult> {
  const isLoaded = await loadCashfreeScript(8000);

  if (!isLoaded || !(window as any).Cashfree) {
    const errorMsg = "Cashfree SDK could not be loaded. Please check your internet connection or ad-blockers.";
    console.warn("[Cashfree]", errorMsg);
    if (options.onFailure) {
      options.onFailure({ message: errorMsg, code: "SDK_UNAVAILABLE" });
    }
    return {
      success: false,
      status: "SDK_UNAVAILABLE",
      error: errorMsg
    };
  }

  if (!options.paymentSessionId) {
    const errorMsg = "Missing Cashfree paymentSessionId for checkout initialization.";
    console.error("[Cashfree]", errorMsg);
    if (options.onFailure) {
      options.onFailure({ message: errorMsg, code: "MISSING_SESSION_ID" });
    }
    return {
      success: false,
      status: "FAILED",
      error: errorMsg
    };
  }

  const mode = options.environment === "production" ? "production" : "sandbox";

  try {
    const cashfree = (window as any).Cashfree({ mode });

    const checkoutResult = await cashfree.checkout({
      paymentSessionId: options.paymentSessionId,
      redirectTarget: options.redirectTarget || "_modal"
    });

    if (checkoutResult.error) {
      console.warn("[Cashfree] Checkout returned error:", checkoutResult.error);
      if (options.onFailure) options.onFailure(checkoutResult.error);
      return {
        success: false,
        status: "FAILED",
        error: checkoutResult.error.message || "Payment was declined or cancelled."
      };
    }

    if (checkoutResult.redirect) {
      console.info("[Cashfree] Payment initiated redirect.");
      return {
        success: true,
        status: "COMPLETED",
        paymentDetails: checkoutResult
      };
    }

    if (checkoutResult.paymentDetails) {
      console.info("[Cashfree] Payment details received:", checkoutResult.paymentDetails);
      if (options.onSuccess) options.onSuccess(checkoutResult.paymentDetails);
      return {
        success: true,
        status: "COMPLETED",
        paymentDetails: checkoutResult.paymentDetails
      };
    }

    // Modal was closed or resolved
    return {
      success: true,
      status: "COMPLETED",
      paymentDetails: checkoutResult
    };
  } catch (err: any) {
    console.error("[Cashfree] Exception during checkout:", err);
    if (options.onFailure) options.onFailure(err);
    return {
      success: false,
      status: "FAILED",
      error: err.message || "An unexpected error occurred during Cashfree checkout."
    };
  }
}
