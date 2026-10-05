#!/usr/bin/env python3
"""
Screenshot OCR Processor

Extracts text from bug report screenshots using OCR (Optical Character Recognition).
Requires tesseract-ocr system package to be installed.
"""

import os
import re
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False


@dataclass
class ScreenshotAnalysis:
    """Analysis result from a screenshot."""
    filename: str = ""
    path: str = ""
    extracted_text: str = ""
    error_messages: list = field(default_factory=list)
    ui_elements: list = field(default_factory=list)
    description: str = ""
    confidence: float = 0.0
    width: int = 0
    height: int = 0
    processed: bool = False
    error: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "filename": self.filename,
            "path": self.path,
            "extracted_text": self.extracted_text,
            "error_messages": self.error_messages,
            "ui_elements": self.ui_elements,
            "description": self.description,
            "confidence": self.confidence,
            "dimensions": {
                "width": self.width,
                "height": self.height,
            },
            "processed": self.processed,
            "error": self.error,
        }


class ScreenshotOCR:
    """OCR processor for screenshots."""

    # Common error patterns to look for in extracted text
    ERROR_PATTERNS = [
        r'error[:\s]+.+',
        r'exception[:\s]+.+',
        r'failed[:\s]+.+',
        r'cannot\s+.+',
        r'unable\s+to\s+.+',
        r'not\s+found',
        r'\d{3}\s+error',  # HTTP errors like "404 error"
        r'internal\s+server\s+error',
        r'access\s+denied',
        r'permission\s+denied',
        r'connection\s+refused',
        r'timeout',
        r'null\s*pointer',
        r'undefined',
        r'syntax\s+error',
    ]

    # UI element patterns
    UI_PATTERNS = [
        (r'\[?\s*(?:OK|Cancel|Yes|No|Close|Submit|Save|Delete)\s*\]?', 'button'),
        (r'(?:Username|Password|Email|Name)[:\s]', 'input_field'),
        (r'(?:Error|Warning|Info|Success)[:\s]', 'alert'),
        (r'(?:Loading|Please wait)', 'loading'),
        (r'(?:Login|Sign in|Register|Sign up)', 'auth_form'),
    ]

    def __init__(self, tesseract_cmd: Optional[str] = None):
        """Initialize OCR processor."""
        self.available = PIL_AVAILABLE and TESSERACT_AVAILABLE

        if tesseract_cmd and TESSERACT_AVAILABLE:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    def check_availability(self) -> tuple:
        """Check if OCR is available."""
        issues = []

        if not PIL_AVAILABLE:
            issues.append("PIL/Pillow not installed. Install with: uv sync")

        if not TESSERACT_AVAILABLE:
            issues.append("pytesseract not installed. Install with: uv sync")

        if TESSERACT_AVAILABLE:
            try:
                pytesseract.get_tesseract_version()
            except Exception:
                issues.append("tesseract-ocr not found. Install system package: apt install tesseract-ocr or brew install tesseract")

        return (len(issues) == 0, issues)

    def process(self, image_path: str) -> ScreenshotAnalysis:
        """Process a screenshot and extract text."""
        analysis = ScreenshotAnalysis()
        analysis.path = image_path
        analysis.filename = os.path.basename(image_path)

        # Check if file exists
        if not os.path.exists(image_path):
            analysis.error = f"File not found: {image_path}"
            return analysis

        # Check availability
        available, issues = self.check_availability()
        if not available:
            analysis.error = "; ".join(issues)
            return analysis

        try:
            # Open image
            image = Image.open(image_path)
            analysis.width = image.width
            analysis.height = image.height

            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')

            # Perform OCR
            text = pytesseract.image_to_string(image)
            analysis.extracted_text = text.strip()

            # Get confidence data
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            confidences = [int(c) for c in data['conf'] if int(c) > 0]
            if confidences:
                analysis.confidence = sum(confidences) / len(confidences)

            # Extract error messages
            analysis.error_messages = self._extract_errors(text)

            # Identify UI elements
            analysis.ui_elements = self._identify_ui_elements(text)

            # Generate description
            analysis.description = self._generate_description(analysis)

            analysis.processed = True

        except Exception as e:
            analysis.error = str(e)

        return analysis

    def _extract_errors(self, text: str) -> list:
        """Extract error messages from text."""
        errors = []
        text_lower = text.lower()

        for pattern in self.ERROR_PATTERNS:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                clean_match = match.strip()
                if clean_match and clean_match not in errors:
                    errors.append(clean_match)

        return errors[:10]  # Limit to 10 errors

    def _identify_ui_elements(self, text: str) -> list:
        """Identify UI elements from text."""
        elements = []

        for pattern, element_type in self.UI_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                elements.append(element_type)

        return list(set(elements))

    def _generate_description(self, analysis: ScreenshotAnalysis) -> str:
        """Generate a description of the screenshot content."""
        parts = []

        # Size description
        if analysis.width > 0:
            parts.append(f"Image size: {analysis.width}x{analysis.height}")

        # Error summary
        if analysis.error_messages:
            parts.append(f"Contains {len(analysis.error_messages)} error message(s)")

        # UI elements
        if analysis.ui_elements:
            parts.append(f"UI elements detected: {', '.join(analysis.ui_elements)}")

        # Text preview
        if analysis.extracted_text:
            preview = analysis.extracted_text[:100]
            if len(analysis.extracted_text) > 100:
                preview += "..."
            parts.append(f"Text preview: {preview}")

        return "; ".join(parts) if parts else "No content extracted"

    def process_multiple(self, image_paths: list) -> list:
        """Process multiple screenshots."""
        return [self.process(path) for path in image_paths]

    def compare_screenshots(self, path1: str, path2: str) -> dict:
        """Compare two screenshots (before/after)."""
        analysis1 = self.process(path1)
        analysis2 = self.process(path2)

        # Find differences in extracted text
        text1_words = set(analysis1.extracted_text.lower().split())
        text2_words = set(analysis2.extracted_text.lower().split())

        added = text2_words - text1_words
        removed = text1_words - text2_words

        # Compare errors
        errors1 = set(analysis1.error_messages)
        errors2 = set(analysis2.error_messages)
        new_errors = errors2 - errors1
        fixed_errors = errors1 - errors2

        return {
            "before": analysis1.to_dict(),
            "after": analysis2.to_dict(),
            "comparison": {
                "text_added": list(added)[:20],
                "text_removed": list(removed)[:20],
                "new_errors": list(new_errors),
                "fixed_errors": list(fixed_errors),
                "size_changed": (analysis1.width != analysis2.width or
                               analysis1.height != analysis2.height),
            }
        }


def process_screenshot(image_path: str) -> ScreenshotAnalysis:
    """Convenience function to process a single screenshot."""
    ocr = ScreenshotOCR()
    return ocr.process(image_path)


if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: screenshot_ocr.py <image_path> [image_path2 ...]")
        print("       screenshot_ocr.py --compare <before.png> <after.png>")
        print("       screenshot_ocr.py --check  (check OCR availability)")
        sys.exit(1)

    ocr = ScreenshotOCR()

    if sys.argv[1] == "--check":
        available, issues = ocr.check_availability()
        if available:
            print("OCR is available and ready to use")
        else:
            print("OCR is not available:")
            for issue in issues:
                print(f"  - {issue}")
        sys.exit(0 if available else 1)

    if sys.argv[1] == "--compare" and len(sys.argv) >= 4:
        result = ocr.compare_screenshots(sys.argv[2], sys.argv[3])
        print(json.dumps(result, indent=2))
    elif len(sys.argv) == 2:
        analysis = ocr.process(sys.argv[1])
        print(json.dumps(analysis.to_dict(), indent=2))
    else:
        results = ocr.process_multiple(sys.argv[1:])
        print(json.dumps([r.to_dict() for r in results], indent=2))
