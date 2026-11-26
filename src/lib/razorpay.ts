/**
 * Client-Side Razorpay Checkout Integration Helper
 * MediVerse Healthcare Telemedicine Platform
 *
 * Provides resilient Razorpay Checkout SDK loading with timeout,
 * strict lifecycle error handling, and safe modal execution.
 */

let scriptLoadingPromise: Promise<boolean> | null = null;

/**
 * Loads the official Razorpay Checkout SDK from CDN with strict timeout and singleton deduplication.
 */
export function loadRazorpayScript(timeoutMs: number = 6000): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  // If Razorpay constructor is already available on window
  if ((window as any).Razorpay) {
    return Promise.resolve(true);
  }

  // Return existing in-flight script load promise if already started
  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve) => {
    // Check if script element was already added
    const existingScript = document.getElementById("razorpay-checkout-sdk") as HTMLScriptElement;
    if (existingScript) {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      // Attach to existing element
      const onExistingLoad = () => resolve(true);
      const onExistingError = () => resolve(false);
      existingScript.addEventListener("load", onExistingLoad, { once: true });
      existingScript.addEventListener("error", onExistingError, { once: true });

      setTimeout(() => {
        if (!(window as any).Razorpay) {
          console.warn("[Razorpay] Timeout waiting for existing script element to load.");
          resolve(false);
        }
      }, timeoutMs);
      return;
    }

    const script = document.createElement("script");
    script.id = "razorpay-checkout-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    let isResolved = false;

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.warn(`[Razorpay] Script loading timed out after ${timeoutMs}ms (CDN or network restriction).`);
        resolve(false);
      }
    }, timeoutMs);

    script.onload = () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        resolve(true);
      }
    };

    script.onerror = () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        console.warn("[Razorpay] Failed to load official checkout.js script from CDN (may be blocked by browser shields or network).");
        resolve(false);
      }
    };

    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}

export interface RazorpayCheckoutOptions {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, any>;
  onOpening?: () => void;
  onOpened?: () => void;
  onSuccess: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onFailure?: (error: any) => void;
  onDismiss?: () => void;
  onInitError?: (error: Error) => void;
}

export interface RazorpayOpenResult {
  success: boolean;
  reason?: "SDK_NOT_LOADED" | "MISSING_KEY_ID" | "OPEN_EXCEPTION" | "OPENED";
  error?: any;
}

/**
 * Initializes and opens Razorpay Checkout modal with safe error catching and callback wiring.
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions
): Promise<RazorpayOpenResult> {
  const isLoaded = await loadRazorpayScript(6000);

  if (!isLoaded || !(window as any).Razorpay) {
    const err = new Error(
      "Razorpay SDK could not be loaded from CDN. Please check your internet connection or disable ad-blockers / Brave Shields."
    );
    console.warn("[Razorpay] SDK unavailable:", err.message);
    if (options.onInitError) {
      options.onInitError(err);
    }
    return { success: false, reason: "SDK_NOT_LOADED", error: err };
  }

  if (!options.keyId) {
    const err = new Error("Missing Razorpay Key ID for checkout initialization.");
    console.error("[Razorpay]", err.message);
    if (options.onInitError) {
      options.onInitError(err);
    }
    return { success: false, reason: "MISSING_KEY_ID", error: err };
  }

  try {
    const rzpOptions: any = {
      key: options.keyId,
      amount: options.amountPaise,
      currency: options.currency || "INR",
      name: options.name || "Healvia Healthcare",
      description: options.description || "Healthcare Consultation Fee",
      order_id: options.orderId,
      prefill: {
        name: options.prefill?.name || "Valued Patient",
        email: options.prefill?.email || "patient@healvia.com",
        contact: options.prefill?.contact || "+91 98401 23456"
      },
      notes: options.notes || {},
      theme: {
        color: "#258FE5"
      },
      modal: {
        backdropclose: false,
        escape: true,
        handleback: true,
        confirm_close: true,
        ondismiss: function () {
          console.info("[Razorpay] Checkout modal dismissed by user.");
          if (options.onDismiss) {
            options.onDismiss();
          }
        }
      },
      handler: function (response: any) {
        console.info("[Razorpay] Payment successful response received from gateway:", response);
        options.onSuccess({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature
        });
      }
    };

    const rzpInstance = new (window as any).Razorpay(rzpOptions);

    rzpInstance.on("payment.failed", function (response: any) {
      console.warn("[Razorpay] payment.failed event received:", response);
      if (options.onFailure) {
        options.onFailure(response.error || { description: "Payment declined by issuing bank." });
      }
    });

    if (options.onOpening) {
      options.onOpening();
    }

    rzpInstance.open();

    if (options.onOpened) {
      options.onOpened();
    }

    return { success: true, reason: "OPENED" };
  } catch (err: any) {
    console.error("[Razorpay] Exception opening Razorpay modal:", err);
    if (options.onInitError) {
      options.onInitError(err instanceof Error ? err : new Error(String(err)));
    }
    return { success: false, reason: "OPEN_EXCEPTION", error: err };
  }
}
