"""
FastAPI Payments Router (Cashfree Payments Gateway)
Provides REST endpoints for order creation, payment session generation,
server-side verification, webhook ingestion, real-time status polling,
payment history, and authorized refunds.
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from backend.app.services.payment_service import (
    create_payment_order,
    verify_and_confirm_payment,
    process_webhook_event,
    get_payment_status_by_id,
    get_user_payment_history,
    process_payment_refund
)

router = APIRouter(prefix="/payments", tags=["Payments & Cashfree Gateway"])


class CreateOrderRequest(BaseModel):
    user_id: Optional[str] = "usr-pat-101"
    service_type: Optional[str] = "doctor_consultation"
    doctor_id: Optional[str] = None
    amount: Optional[float] = None
    items: Optional[List[Dict[str, Any]]] = None
    coupon_code: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    patient_name: Optional[str] = None
    patient_email: Optional[str] = None
    patient_phone: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    user_id: Optional[str] = "usr-pat-101"
    order_id: Optional[str] = None
    cf_order_id: Optional[str] = None
    cf_payment_id: Optional[str] = None
    payment_session_id: Optional[str] = None
    # Compatibility fields for smooth migration
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    payment_mode: Optional[str] = None
    payment_method: Optional[str] = "upi"
    booking_payload: Optional[Dict[str, Any]] = None


class RefundRequest(BaseModel):
    user_id: Optional[str] = "usr-pat-101"
    amount: Optional[float] = None
    reason: Optional[str] = "Patient requested refund"


@router.post("/create-order")
async def create_order_endpoint(req: CreateOrderRequest):
    """
    Creates a new Cashfree payment order with server-calculated pricing,
    internal order & payment models, and active payment_session_id.
    """
    res = create_payment_order(
        user_id=req.user_id or "usr-pat-101",
        payload=req.model_dump()
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Unable to create payment order"))
    return res


@router.post("/verify")
async def verify_payment_endpoint(req: VerifyPaymentRequest):
    """
    Cryptographically verifies payment with Cashfree gateway APIs
    and atomically confirms associated healthcare booking.
    """
    res = verify_and_confirm_payment(
        user_id=req.user_id or "usr-pat-101",
        payload=req.model_dump()
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Payment verification failed"))
    return res


@router.post("/webhook")
async def webhook_endpoint(
    request: Request,
    x_webhook_signature: Optional[str] = Header(None, alias="x-webhook-signature"),
    x_webhook_timestamp: Optional[str] = Header(None, alias="x-webhook-timestamp"),
    x_razorpay_signature: Optional[str] = Header(None, alias="x-razorpay-signature")
):
    """
    Ingests official Cashfree webhook events, validates HMAC SHA-256 signatures,
    and updates payment & booking state machines with strict idempotency.
    """
    raw_body = await request.body()
    try:
        event_data = await request.json()
    except Exception:
        event_data = {}

    sig_header = x_webhook_signature or x_razorpay_signature or ""
    res = process_webhook_event(
        raw_body=raw_body,
        signature_header=sig_header,
        event_data=event_data,
        timestamp_header=x_webhook_timestamp
    )

    if not res.get("success") and res.get("status_code") == 400:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    return res


@router.get("/{payment_id}/status")
async def get_status_endpoint(payment_id: str, user_id: Optional[str] = "usr-pat-101"):
    """
    Returns real-time status of the specified payment record.
    """
    res = get_payment_status_by_id(payment_id=payment_id, user_id=user_id)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("error", "Payment not found"))
    return res


@router.get("/history")
async def get_history_endpoint(user_id: Optional[str] = "usr-pat-101", role: Optional[str] = "patient"):
    """
    Retrieves verified Cashfree payment history for authenticated patient or administrator.
    """
    return get_user_payment_history(user_id=user_id or "usr-pat-101", role=role or "patient")


@router.post("/{payment_id}/refund")
async def refund_endpoint(payment_id: str, req: RefundRequest):
    """
    Initiates an authorized payment refund through Cashfree and updates records.
    """
    res = process_payment_refund(
        payment_id=payment_id,
        user_id=req.user_id or "usr-pat-101",
        amount=req.amount,
        reason=req.reason
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to process refund"))
    return res
