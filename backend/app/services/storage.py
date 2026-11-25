import os
import re
import uuid
import hashlib
from pathlib import Path
from typing import Tuple
from fastapi import UploadFile, HTTPException
from backend.app.config import settings

# Recognized magic bytes signatures for medical and standard document formats
MAGIC_SIGNATURES = {
    # PDF: starts with %PDF-
    b"%PDF": "application/pdf",
    # JPEG: starts with \xFF\xD8\xFF
    b"\xFF\xD8\xFF": "image/jpeg",
    # PNG: starts with \x89PNG\r\n\x1a\n
    b"\x89PNG": "image/png",
    # WEBP: RIFF....WEBP
    b"RIFF": "image/webp",
    # TIFF: II*\x00 (little endian) or MM\x00* (big endian)
    b"II*\x00": "image/tiff",
    b"MM\x00*": "image/tiff",
    # BMP: starts with BM
    b"BM": "image/bmp",
    # ZIP / DOCX / XLSX (PKzip format)
    b"PK\x03\x04": "application/zip",
    # Legacy Word / Excel / RTF
    b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1": "application/msword",
    b"{\\rtf": "application/rtf",
    # DICOM: prefix at offset 128 is "DICM"
}

# Executable / dangerous signatures to strictly reject
FORBIDDEN_SIGNATURES = [
    b"MZ",       # DOS / PE executable (.exe, .dll)
    b"\x7FELF",  # Linux ELF executable
    b"#!",       # Shell script
    b"<?php",    # PHP script
    b"<script",  # HTML / JS script injection
]

FORBIDDEN_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".vbs", ".dll", ".so", ".bin", ".com",
    ".msi", ".jar", ".py", ".php", ".js", ".html", ".htm", ".ps1"
}


class StorageService:
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Strip dangerous characters and directory traversal elements."""
        base = Path(filename).name
        # Allow alphanumeric, hyphens, underscores, dots, spaces
        cleaned = re.sub(r"[^\w\s\.-]", "_", base).strip()
        return cleaned or "document"

    @staticmethod
    def validate_file_security(file_bytes: bytes, original_filename: str) -> str:
        """
        Verify file size, extension, forbidden signatures, and MIME signature.
        Never trust file extension alone.
        """
        if not file_bytes:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

        if len(file_bytes) > settings.MAX_FILE_SIZE_BYTES:
            max_mb = settings.MAX_FILE_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum allowable size of {max_mb} MB."
            )

        ext = Path(original_filename).suffix.lower()
        if ext in FORBIDDEN_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Executable and script file uploads are forbidden.")

        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format '{ext}'. Allowed: {', '.join(sorted(settings.ALLOWED_EXTENSIONS))}"
            )

        # Check for forbidden executable signatures
        for forbidden in FORBIDDEN_SIGNATURES:
            if file_bytes.startswith(forbidden):
                raise HTTPException(status_code=400, detail="Security violation: Executable payload detected.")

        # Check DICOM: DICOM files usually have a 128-byte preamble followed by 'DICM'
        if ext in {".dcm", ".dicom"} or (len(file_bytes) > 132 and file_bytes[128:132] == b"DICM"):
            return "application/dicom"

        # Check known signatures
        matched_mime = None
        for sig, mime in MAGIC_SIGNATURES.items():
            if file_bytes.startswith(sig):
                matched_mime = mime
                break

        # Plain text and CSV fallback
        if not matched_mime:
            if ext in {".txt", ".csv"}:
                try:
                    file_bytes[:1024].decode("utf-8")
                    return "text/plain" if ext == ".txt" else "text/csv"
                except UnicodeDecodeError:
                    raise HTTPException(status_code=400, detail="Invalid character encoding for text file.")
            else:
                # If extension is docx/xlsx, PK signature is verified
                if ext in {".docx", ".xlsx"} and file_bytes.startswith(b"PK\x03\x04"):
                    return "application/vnd.openxmlformats-officedocument"
                raise HTTPException(status_code=400, detail="File content does not match its stated signature.")

        return matched_mime

    @classmethod
    def save_document(cls, file_bytes: bytes, original_filename: str, patient_id: str) -> Tuple[str, str, str, str]:
        """
        Securely save document to private storage.
        Returns: (doc_id, storage_path, mime_type, file_hash)
        """
        mime_type = cls.validate_file_security(file_bytes, original_filename)
        sanitized_name = cls.sanitize_filename(original_filename)
        
        doc_id = f"doc_{uuid.uuid4().hex[:16]}"
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        
        # Partition directory by patient to prevent cross-contamination and ensure isolated traversal
        patient_storage_dir = settings.STORAGE_DIR / patient_id
        patient_storage_dir.mkdir(parents=True, exist_ok=True)
        
        ext = Path(sanitized_name).suffix.lower()
        storage_filename = f"{doc_id}{ext}"
        target_path = patient_storage_dir / storage_filename
        
        with open(target_path, "wb") as f:
            f.write(file_bytes)
            
        return doc_id, str(target_path), mime_type, file_hash

    @classmethod
    def read_document_bytes(cls, storage_path: str, patient_id: str) -> bytes:
        """Securely read document verifying patient boundary."""
        path = Path(storage_path).resolve()
        
        # Prevent path traversal outside storage directory
        base_storage = settings.STORAGE_DIR.resolve()
        if base_storage not in path.parents:
            raise HTTPException(status_code=403, detail="Access denied: invalid storage path.")
            
        # Verify patient ownership isolation in directory hierarchy
        if path.parent.name != patient_id:
            raise HTTPException(status_code=403, detail="Access denied: patient boundary violation.")
            
        if not path.exists():
            raise HTTPException(status_code=404, detail="Requested medical document file not found.")
            
        with open(path, "rb") as f:
            return f.read()

    @classmethod
    def save_uploaded_file(cls, file_bytes: bytes, original_filename: str, patient_id: str) -> dict:
        """Convenience method returning dictionary of stored file metadata."""
        doc_id, storage_path, mime_type, file_hash = cls.save_document(file_bytes, original_filename, patient_id)
        return {
            "document_id": doc_id,
            "stored_path": storage_path,
            "mime_type": mime_type,
            "file_hash": file_hash,
            "file_size_bytes": len(file_bytes)
        }

    @classmethod
    def delete_file(cls, storage_path: str) -> bool:
        """Convenience delete method safely deleting path if it exists."""
        try:
            p = Path(storage_path).resolve()
            if p.exists() and settings.STORAGE_DIR.resolve() in p.parents:
                p.unlink()
                return True
        except Exception:
            pass
        return False

    @classmethod
    def delete_document_file(cls, storage_path: str, patient_id: str) -> bool:
        """Securely remove document from private disk storage."""
        try:
            path = Path(storage_path).resolve()
            base_storage = settings.STORAGE_DIR.resolve()
            if base_storage in path.parents and path.parent.name == patient_id and path.exists():
                path.unlink()
                return True
        except Exception:
            pass
        return False
