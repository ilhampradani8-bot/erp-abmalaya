#!/usr/bin/env python3
"""
Severity Analyzer

Automatically analyzes bug reports and assigns severity and priority
based on impact, error types, and keywords.
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class SeverityAssessment:
    """Assessment result for bug severity."""
    severity: str = "medium"
    priority: str = "normal"
    confidence: float = 0.0
    factors: list = None
    recommendations: list = None
    is_regression: bool = False
    affected_users: int = 0
    impact_description: str = ""

    def __post_init__(self):
        if self.factors is None:
            self.factors = []
        if self.recommendations is None:
            self.recommendations = []

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "severity": self.severity,
            "priority": self.priority,
            "confidence": self.confidence,
            "factors": self.factors,
            "recommendations": self.recommendations,
            "is_regression": self.is_regression,
            "affected_users": self.affected_users,
            "impact_description": self.impact_description,
        }


class SeverityAnalyzer:
    """Analyzes bug severity based on multiple factors."""

    # Keywords indicating critical severity
    CRITICAL_KEYWORDS = [
        "crash", "data loss", "data corruption", "security vulnerability",
        "security breach", "authentication bypass", "sql injection",
        "xss", "remote code execution", "rce", "privilege escalation",
        "production down", "service outage", "complete failure",
        "cannot access", "locked out", "infinite loop", "memory leak",
        "deadlock", "data breach", "pii exposure",
    ]

    # Keywords indicating high severity
    HIGH_KEYWORDS = [
        "broken", "fails", "cannot", "unable", "blocked", "prevents",
        "not working", "stops working", "feature broken", "regression",
        "lost", "missing data", "incorrect data", "wrong results",
        "payment failed", "checkout broken", "login broken",
        "500 error", "server error", "timeout", "unresponsive",
    ]

    # Keywords indicating medium severity
    MEDIUM_KEYWORDS = [
        "slow", "degraded", "workaround", "inconsistent", "sometimes",
        "intermittent", "occasionally", "partial", "incorrect display",
        "wrong format", "ui issue", "layout broken", "styling issue",
        "unexpected behavior", "confusing",
    ]

    # Keywords indicating low severity
    LOW_KEYWORDS = [
        "minor", "cosmetic", "typo", "spelling", "alignment",
        "color", "font", "padding", "margin", "spacing",
        "enhancement", "improvement", "nice to have", "polish",
    ]

    # Error types and their severity implications
    ERROR_SEVERITY = {
        "critical": [
            "OutOfMemoryError", "StackOverflowError", "SystemExit",
            "SegmentationFault", "AccessViolation", "KernelPanic",
        ],
        "high": [
            "NullPointerException", "TypeError", "ReferenceError",
            "IndexOutOfBoundsException", "KeyError", "AttributeError",
            "ConnectionError", "TimeoutError", "AuthenticationError",
        ],
        "medium": [
            "ValueError", "ValidationError", "ParseError",
            "FileNotFoundError", "PermissionError", "IOError",
        ],
        "low": [
            "Warning", "DeprecationWarning", "UserWarning",
        ],
    }

    # Severity levels in order
    SEVERITY_ORDER = ["critical", "high", "medium", "low", "trivial"]

    # Priority mapping from severity
    SEVERITY_TO_PRIORITY = {
        "critical": "urgent",
        "high": "high",
        "medium": "normal",
        "low": "low",
        "trivial": "low",
    }

    def analyze(self, bug_data: dict) -> SeverityAssessment:
        """Analyze bug data and determine severity."""
        assessment = SeverityAssessment()

        # Collect text for analysis
        text_parts = []

        if isinstance(bug_data.get("title"), str):
            text_parts.append(bug_data["title"])

        description = bug_data.get("description", {})
        if isinstance(description, dict):
            text_parts.extend([
                description.get("summary", ""),
                description.get("observed_behavior", ""),
                description.get("expected_behavior", ""),
                description.get("additional_context", ""),
            ])
        elif isinstance(description, str):
            text_parts.append(description)

        # Add reproduction steps
        reproduction = bug_data.get("reproduction", {})
        if isinstance(reproduction, dict):
            steps = reproduction.get("steps", [])
            if isinstance(steps, list):
                text_parts.extend(steps)

        # Add error analysis
        error_analysis = bug_data.get("error_analysis", {})
        if isinstance(error_analysis, dict):
            text_parts.append(error_analysis.get("error_type", ""))
            text_parts.append(error_analysis.get("error_message", ""))

        # Combine all text
        full_text = " ".join(str(t) for t in text_parts if t).lower()

        # Analyze keywords
        keyword_severity = self._analyze_keywords(full_text, assessment)

        # Analyze error types
        error_severity = self._analyze_error_types(bug_data, assessment)

        # Check for regression
        self._check_regression(bug_data, full_text, assessment)

        # Analyze affected users
        self._analyze_affected_users(bug_data, full_text, assessment)

        # Determine final severity
        severities = [keyword_severity, error_severity]
        if assessment.is_regression:
            severities.append("high")  # Regressions are at least high

        # Take the highest severity
        final_severity = self._highest_severity(severities)
        assessment.severity = final_severity
        assessment.priority = self.SEVERITY_TO_PRIORITY.get(final_severity, "normal")

        # Calculate confidence based on number of factors
        assessment.confidence = min(len(assessment.factors) * 0.2, 1.0)

        # Generate impact description
        assessment.impact_description = self._generate_impact_description(assessment)

        # Add recommendations
        self._add_recommendations(assessment)

        return assessment

    def _analyze_keywords(self, text: str, assessment: SeverityAssessment) -> str:
        """Analyze keywords in text."""
        # Check critical keywords
        for keyword in self.CRITICAL_KEYWORDS:
            if keyword in text:
                assessment.factors.append(f"Critical keyword found: '{keyword}'")
                return "critical"

        # Check high keywords
        for keyword in self.HIGH_KEYWORDS:
            if keyword in text:
                assessment.factors.append(f"High-severity keyword found: '{keyword}'")
                return "high"

        # Check medium keywords
        for keyword in self.MEDIUM_KEYWORDS:
            if keyword in text:
                assessment.factors.append(f"Medium-severity keyword found: '{keyword}'")
                return "medium"

        # Check low keywords
        for keyword in self.LOW_KEYWORDS:
            if keyword in text:
                assessment.factors.append(f"Low-severity keyword found: '{keyword}'")
                return "low"

        return "medium"  # Default

    def _analyze_error_types(self, bug_data: dict, assessment: SeverityAssessment) -> str:
        """Analyze error types from stack traces."""
        error_analysis = bug_data.get("error_analysis", {})
        error_type = error_analysis.get("error_type", "")

        if not error_type:
            # Check stack traces
            stack_traces = bug_data.get("stack_traces", [])
            for trace in stack_traces:
                if isinstance(trace, dict):
                    error_type = trace.get("error_type", "")
                    if error_type:
                        break

        if error_type:
            for severity, error_types in self.ERROR_SEVERITY.items():
                for known_error in error_types:
                    if known_error.lower() in error_type.lower():
                        assessment.factors.append(f"Error type '{error_type}' indicates {severity} severity")
                        return severity

        return "medium"

    def _check_regression(self, bug_data: dict, text: str, assessment: SeverityAssessment):
        """Check if bug is a regression."""
        # Check explicit regression flag
        metadata = bug_data.get("metadata", {})
        if metadata.get("regression"):
            assessment.is_regression = True
            assessment.factors.append("Marked as regression")
            return

        # Check labels
        labels = metadata.get("labels", [])
        if "regression" in [l.lower() for l in labels]:
            assessment.is_regression = True
            assessment.factors.append("Labeled as regression")
            return

        # Check text for regression indicators
        regression_patterns = [
            r"regression",
            r"worked before",
            r"was working",
            r"stopped working",
            r"broke after",
            r"since version",
            r"after update",
            r"after deploy",
        ]

        for pattern in regression_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                assessment.is_regression = True
                assessment.factors.append(f"Regression indicator found: '{pattern}'")
                return

    def _analyze_affected_users(self, bug_data: dict, text: str, assessment: SeverityAssessment):
        """Analyze number of affected users."""
        metadata = bug_data.get("metadata", {})

        # Check explicit affected_users field
        affected = metadata.get("affected_users", 0)
        if affected:
            assessment.affected_users = affected
            if affected >= 1000:
                assessment.factors.append(f"High user impact: {affected} users affected")
            elif affected >= 100:
                assessment.factors.append(f"Moderate user impact: {affected} users affected")
            return

        # Try to extract from text
        user_patterns = [
            r"(\d+(?:,\d+)?)\s*users?\s*affected",
            r"affects?\s*(\d+(?:,\d+)?)\s*users?",
            r"(\d+)%\s*of\s*users",
            r"all\s*users",
        ]

        for pattern in user_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if "all users" in match.group(0).lower():
                    assessment.factors.append("All users affected")
                    assessment.affected_users = -1  # Indicates all users
                else:
                    try:
                        count = int(match.group(1).replace(",", ""))
                        assessment.affected_users = count
                        assessment.factors.append(f"Estimated {count} users affected")
                    except (ValueError, IndexError):
                        pass
                return

    def _highest_severity(self, severities: list) -> str:
        """Get the highest severity from a list."""
        for severity in self.SEVERITY_ORDER:
            if severity in severities:
                return severity
        return "medium"

    def _generate_impact_description(self, assessment: SeverityAssessment) -> str:
        """Generate a human-readable impact description."""
        parts = []

        if assessment.severity == "critical":
            parts.append("Critical impact requiring immediate attention")
        elif assessment.severity == "high":
            parts.append("High impact affecting core functionality")
        elif assessment.severity == "medium":
            parts.append("Moderate impact with potential workarounds")
        elif assessment.severity == "low":
            parts.append("Low impact, minor inconvenience")
        else:
            parts.append("Trivial impact, cosmetic issue")

        if assessment.is_regression:
            parts.append("This is a regression from previous version")

        if assessment.affected_users == -1:
            parts.append("Affects all users")
        elif assessment.affected_users > 0:
            parts.append(f"Affects approximately {assessment.affected_users} users")

        return ". ".join(parts) + "."

    def _add_recommendations(self, assessment: SeverityAssessment):
        """Add response recommendations based on severity."""
        if assessment.severity == "critical":
            assessment.recommendations = [
                "Assign to senior developer immediately",
                "Consider hotfix deployment",
                "Notify stakeholders",
                "Monitor for additional reports",
            ]
        elif assessment.severity == "high":
            assessment.recommendations = [
                "Prioritize for current sprint",
                "Assign to experienced developer",
                "Identify and document workarounds",
            ]
        elif assessment.severity == "medium":
            assessment.recommendations = [
                "Schedule for upcoming sprint",
                "Document workarounds if available",
            ]
        elif assessment.severity == "low":
            assessment.recommendations = [
                "Add to backlog",
                "Consider bundling with related fixes",
            ]
        else:
            assessment.recommendations = [
                "Add to backlog for future consideration",
            ]

        if assessment.is_regression:
            assessment.recommendations.insert(0, "Review recent deployments/commits")


def analyze_severity(bug_data: dict) -> SeverityAssessment:
    """Convenience function to analyze bug severity."""
    analyzer = SeverityAnalyzer()
    return analyzer.analyze(bug_data)


if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: severity_analyzer.py <bug-report.json>")
        print("       severity_analyzer.py <bug-report.md>")
        sys.exit(1)

    file_path = sys.argv[1]

    if file_path.endswith(".json"):
        with open(file_path, 'r') as f:
            bug_data = json.load(f)
    elif file_path.endswith(".md"):
        # Parse markdown first
        from parse_markdown import parse_bug_report
        report = parse_bug_report(file_path)
        bug_data = report.to_dict()
    else:
        print("Error: File must be .json or .md")
        sys.exit(1)

    assessment = analyze_severity(bug_data)
    print(json.dumps(assessment.to_dict(), indent=2))
