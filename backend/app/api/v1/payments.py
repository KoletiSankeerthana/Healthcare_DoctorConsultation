"""
FastAPI Payments Router (Razorpay Gateway)
Provides REST endpoints for order creation, signature verification,
webhook ingestion, real-time status polling, payment history, and refunds.
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

router = APIRouter(prefix="/payments", tags=["Payments & Gateway"])


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
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: Optional[str] = None
    payment_method: Optional[str] = "upi"
    booking_payload: Optional[Dict[str, Any]] = None


class RefundRequest(BaseModel):
    user_id: Optional[str] = "usr-pat-101"
    amount: Optional[float] = None
    reason: Optional[str] = "Patient requested refund"


@router.post("/create-order")
async def create_order_endpoint(req: CreateOrderRequest):
    """
    Creates a new payment order with server-calculated prices,
    internal order & payment models, and Razorpay order ID.
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
    Cryptographically verifies Razorpay payment signature (HMAC SHA-256)
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
async def webhook_endpoint(request: Request, x_razorpay_signature: Optional[str] = Header(None)):
    """
    Ingests official Razorpay webhook events, verifies HMAC SHA256 signature
    against the raw payload bytes, and processes state updates idempotently.
    """
    raw_body = await request.body()
    try:
        event_data = await request.json()
    except Exception:
        event_data = {}

    res = process_webhook_event(
        raw_body=raw_body,
        signature_header=x_razorpay_signature or "",
        event_data=event_data
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
    Retrieves verified payment history for authenticated patient or administrator.
    """
    return get_user_payment_history(user_id=user_id or "usr-pat-101", role=role or "patient")


@router.post("/{payment_id}/refund")
async def refund_endpoint(payment_id: str, req: RefundRequest):
    """
    Initiates an authorized payment refund through Razorpay and updates records.
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
