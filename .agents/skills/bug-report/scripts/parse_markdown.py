#!/usr/bin/env python3
"""
Markdown Bug Report Parser

Parses bug report markdown files from various ticket systems and extracts
structured information including metadata, reproduction steps, environment
details, and error logs.
"""

import re
import os
import yaml
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class BugReport:
    """Structured representation of a parsed bug report."""
    bug_id: str = ""
    title: str = ""
    severity: str = "medium"
    priority: str = "normal"
    status: str = "new"
    reporter: str = ""
    assignee: str = ""
    labels: list = field(default_factory=list)

    description: str = ""
    observed_behavior: str = ""
    expected_behavior: str = ""
    additional_context: str = ""

    reproduction_steps: list = field(default_factory=list)
    reproduction_rate: str = ""

    environment: dict = field(default_factory=dict)

    error_logs: list = field(default_factory=list)
    stack_traces: list = field(default_factory=list)

    screenshots: list = field(default_factory=list)
    attachments: list = field(default_factory=list)

    affected_versions: list = field(default_factory=list)
    target_fix_version: str = ""
    is_regression: bool = False

    related_issues: list = field(default_factory=list)

    source_format: str = "unknown"
    source_file: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "bug_id": self.bug_id,
            "title": self.title,
            "severity": self.severity,
            "priority": self.priority,
            "status": self.status,
            "metadata": {
                "reporter": self.reporter,
                "assignee": self.assignee,
                "labels": self.labels,
                "affected_versions": self.affected_versions,
                "target_fix_version": self.target_fix_version,
                "regression": self.is_regression,
            },
            "description": {
                "summary": self.description,
                "observed_behavior": self.observed_behavior,
                "expected_behavior": self.expected_behavior,
                "additional_context": self.additional_context,
            },
            "reproduction": {
                "steps": self.reproduction_steps,
                "reproduction_rate": self.reproduction_rate,
            },
            "environment": self.environment,
            "error_logs": self.error_logs,
            "stack_traces": self.stack_traces,
            "screenshots": self.screenshots,
            "attachments": self.attachments,
            "related_issues": self.related_issues,
            "source_format": self.source_format,
            "source_file": self.source_file,
        }


class MarkdownParser:
    """Parser for bug report markdown files."""

    def __init__(self, config_dir: Optional[str] = None):
        """Initialize parser with optional config directory."""
        self.config_dir = config_dir or self._default_config_dir()
        self.field_mappings = self._load_field_mappings()

    def _default_config_dir(self) -> str:
        """Get default config directory path."""
        return str(Path(__file__).parent.parent / "config")

    def _load_field_mappings(self) -> dict:
        """Load field mappings from config files."""
        mappings = {}
        mappings_file = Path(self.config_dir) / "field_mappings.yaml"
        if mappings_file.exists():
            with open(mappings_file, 'r') as f:
                mappings = yaml.safe_load(f) or {}
        return mappings

    def detect_format(self, content: str) -> str:
        """Auto-detect the bug report format based on content patterns."""
        # Linear format: "# BUG-XXX - Title" or "**Status**:"
        if re.search(r'^#\s+[A-Z]+-\d+\s+-', content, re.MULTILINE):
            return "linear"
        if "**Status**:" in content and "**Cycle**:" in content:
            return "linear"

        # GitHub format: "**Labels**:" or "**Assignee**: @"
        if "**Labels**:" in content or "**Assignee**: @" in content:
            return "github"
        if "**Milestone**:" in content:
            return "github"

        # Bugzilla format
        if "**Product**:" in content or "**Component**:" in content:
            return "bugzilla"

        # Default to generic
        return "generic"

    def parse(self, file_path: str, format_type: Optional[str] = None) -> BugReport:
        """Parse a bug report markdown file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        if format_type is None:
            format_type = self.detect_format(content)

        report = BugReport()
        report.source_file = file_path
        report.source_format = format_type

        # Parse based on format
        if format_type == "github":
            self._parse_github_format(content, report)
        elif format_type == "linear":
            self._parse_linear_format(content, report)
        elif format_type == "bugzilla":
            self._parse_bugzilla_format(content, report)
        else:
            self._parse_generic_format(content, report)

        # Extract common elements
        self._extract_code_blocks(content, report)
        self._extract_screenshots(content, report, file_path)
        self._extract_environment(content, report)
        self._extract_reproduction_steps(content, report)

        return report

    def _parse_github_format(self, content: str, report: BugReport):
        """Parse GitHub Issues format."""
        # Title: # Bug: Title or # Title
        title_match = re.search(r'^#\s+(?:Bug:\s+)?(.+?)$', content, re.MULTILINE)
        if title_match:
            report.title = title_match.group(1).strip()

        # Labels
        labels_match = re.search(r'\*\*Labels\*\*:\s*(.+?)(?:\n|$)', content)
        if labels_match:
            report.labels = [l.strip() for l in labels_match.group(1).split(',')]

        # Assignee
        assignee_match = re.search(r'\*\*Assignee\*\*:\s*@?(\S+)', content)
        if assignee_match:
            report.assignee = assignee_match.group(1)

        # Reporter (Opened by)
        reporter_match = re.search(r'\*\*Opened by\*\*:\s*@?(\S+)', content)
        if reporter_match:
            report.reporter = reporter_match.group(1)

        # Bug ID from title or generate
        id_match = re.search(r'#(\d+)', report.title)
        if id_match:
            report.bug_id = f"GH-{id_match.group(1)}"
        else:
            report.bug_id = self._generate_bug_id(report.title)

        # Description section
        self._extract_section(content, ["## Description", "## Problem"], report, "description")

        # Expected/Actual behavior
        self._extract_section(content, ["## Expected Behavior", "## Expected"], report, "expected_behavior")
        self._extract_section(content, ["## Actual Behavior", "## Actual"], report, "observed_behavior")

        # Additional context
        self._extract_section(content, ["## Additional Context", "## Notes"], report, "additional_context")

        # Severity from labels or explicit
        self._extract_severity(content, report)

    def _parse_linear_format(self, content: str, report: BugReport):
        """Parse Linear format."""
        # Title: # BUG-123 - Title
        title_match = re.search(r'^#\s+([A-Z]+-\d+)\s+-\s+(.+?)$', content, re.MULTILINE)
        if title_match:
            report.bug_id = title_match.group(1)
            report.title = title_match.group(2).strip()
        else:
            # Fallback title parsing
            title_match = re.search(r'^#\s+(.+?)$', content, re.MULTILINE)
            if title_match:
                report.title = title_match.group(1).strip()
                report.bug_id = self._generate_bug_id(report.title)

        # Status
        status_match = re.search(r'\*\*Status\*\*:\s*(.+?)(?:\n|$)', content)
        if status_match:
            report.status = status_match.group(1).strip().lower().replace(" ", "_")

        # Priority
        priority_match = re.search(r'\*\*Priority\*\*:\s*(.+?)(?:\n|$)', content)
        if priority_match:
            report.priority = priority_match.group(1).strip().lower()

        # Assignee
        assignee_match = re.search(r'\*\*Assignee\*\*:\s*(.+?)(?:\n|$)', content)
        if assignee_match:
            report.assignee = assignee_match.group(1).strip()

        # Reporter
        reporter_match = re.search(r'\*\*Reporter\*\*:\s*(.+?)(?:\n|$)', content)
        if reporter_match:
            report.reporter = reporter_match.group(1).strip()

        # Labels
        labels_match = re.search(r'\*\*Labels\*\*:\s*(.+?)(?:\n|$)', content)
        if labels_match:
            report.labels = [l.strip() for l in labels_match.group(1).split(',')]

        # Problem/Description
        self._extract_section(content, ["## Problem", "## Description"], report, "description")

        # Impact
        self._extract_section(content, ["## Impact"], report, "additional_context")

        # Expected vs Actual
        expected_actual = re.search(
            r'## Expected vs Actual\s*\n(.*?)(?=\n##|\Z)',
            content, re.DOTALL
        )
        if expected_actual:
            text = expected_actual.group(1)
            expected_match = re.search(r'Expected:\s*(.+?)(?:\n|$)', text)
            actual_match = re.search(r'Actual:\s*(.+?)(?:\n|$)', text)
            if expected_match:
                report.expected_behavior = expected_match.group(1).strip()
            if actual_match:
                report.observed_behavior = actual_match.group(1).strip()

        self._extract_severity(content, report)

    def _parse_bugzilla_format(self, content: str, report: BugReport):
        """Parse Bugzilla format."""
        # Bug ID
        id_match = re.search(r'\*\*Bug ID\*\*:\s*(\d+)', content)
        if id_match:
            report.bug_id = f"BZ-{id_match.group(1)}"

        # Title
        title_match = re.search(r'^#\s+(.+?)$', content, re.MULTILINE)
        if title_match:
            report.title = title_match.group(1).strip()

        if not report.bug_id:
            report.bug_id = self._generate_bug_id(report.title)

        # Standard fields
        self._extract_section(content, ["## Description", "## Summary"], report, "description")
        self._extract_section(content, ["## Expected Results"], report, "expected_behavior")
        self._extract_section(content, ["## Actual Results"], report, "observed_behavior")

        self._extract_severity(content, report)

    def _parse_generic_format(self, content: str, report: BugReport):
        """Parse generic/unknown format using common patterns."""
        # Title from first H1
        title_match = re.search(r'^#\s+(.+?)$', content, re.MULTILINE)
        if title_match:
            report.title = title_match.group(1).strip()

        report.bug_id = self._generate_bug_id(report.title)

        # Try common section names
        self._extract_section(content, [
            "## Description", "## Problem", "## Issue", "## Bug"
        ], report, "description")

        self._extract_section(content, [
            "## Expected", "## Expected Behavior", "## Should"
        ], report, "expected_behavior")

        self._extract_section(content, [
            "## Actual", "## Actual Behavior", "## Result", "## Observed"
        ], report, "observed_behavior")

        self._extract_severity(content, report)

    def _extract_section(self, content: str, headers: list, report: BugReport, field: str):
        """Extract content from a section by trying multiple header names."""
        for header in headers:
            pattern = rf'{re.escape(header)}\s*\n(.*?)(?=\n##|\Z)'
            match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
            if match:
                value = match.group(1).strip()
                setattr(report, field, value)
                return

    def _extract_code_blocks(self, content: str, report: BugReport):
        """Extract code blocks as potential error logs/stack traces."""
        # Find all fenced code blocks
        code_blocks = re.findall(r'```(\w*)\n(.*?)```', content, re.DOTALL)

        for lang, code in code_blocks:
            code = code.strip()
            # Check if it looks like a stack trace or error log
            if self._is_stack_trace(code):
                report.stack_traces.append({
                    "language": lang or "unknown",
                    "content": code
                })
            elif self._is_error_log(code):
                report.error_logs.append({
                    "type": "code_block",
                    "language": lang or "unknown",
                    "content": code
                })

    def _is_stack_trace(self, text: str) -> bool:
        """Check if text looks like a stack trace."""
        patterns = [
            r'Traceback \(most recent call last\)',  # Python
            r'at .+\(.+:\d+:\d+\)',  # JavaScript
            r'at .+\(.+\.java:\d+\)',  # Java
            r'at .+ in .+:line \d+',  # C#
            r'Error:',
            r'Exception:',
            r'TypeError:',
            r'ValueError:',
            r'NullPointerException',
        ]
        return any(re.search(p, text) for p in patterns)

    def _is_error_log(self, text: str) -> bool:
        """Check if text looks like an error log."""
        patterns = [
            r'\[ERROR\]',
            r'\[FATAL\]',
            r'ERROR:',
            r'FATAL:',
            r'Console Error:',
            r'Failed to',
            r'Cannot ',
        ]
        return any(re.search(p, text, re.IGNORECASE) for p in patterns)

    def _extract_screenshots(self, content: str, report: BugReport, file_path: str):
        """Extract screenshot references from markdown."""
        base_dir = os.path.dirname(file_path)

        # Find markdown image syntax: ![alt](path)
        images = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', content)

        for alt_text, img_path in images:
            # Resolve relative paths
            if not os.path.isabs(img_path):
                img_path = os.path.join(base_dir, img_path)

            report.screenshots.append({
                "filename": os.path.basename(img_path),
                "path": img_path,
                "description": alt_text,
            })

    def _extract_environment(self, content: str, report: BugReport):
        """Extract environment details."""
        env_section = re.search(
            r'## Environment\s*\n(.*?)(?=\n##|\Z)',
            content, re.DOTALL | re.IGNORECASE
        )

        if env_section:
            env_text = env_section.group(1)

            # Parse list items: - **Key**: Value or - Key: Value
            items = re.findall(r'-\s*\*?\*?([^:*]+)\*?\*?:\s*(.+?)(?:\n|$)', env_text)

            for key, value in items:
                key = key.strip().lower().replace(" ", "_")
                report.environment[key] = value.strip()

    def _extract_reproduction_steps(self, content: str, report: BugReport):
        """Extract reproduction steps."""
        # Try various section names
        for header in ["## Steps to Reproduce", "## Reproduction Steps", "## Steps", "## How to Reproduce"]:
            pattern = rf'{re.escape(header)}\s*\n(.*?)(?=\n##|\Z)'
            match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
            if match:
                steps_text = match.group(1)
                # Parse numbered list
                steps = re.findall(r'^\d+\.\s*(.+?)$', steps_text, re.MULTILINE)
                if steps:
                    report.reproduction_steps = steps
                    return

    def _extract_severity(self, content: str, report: BugReport):
        """Extract severity from content."""
        # Explicit severity field
        severity_match = re.search(r'\*\*Severity\*\*:\s*(\w+)', content, re.IGNORECASE)
        if severity_match:
            report.severity = severity_match.group(1).lower()
            return

        # From labels
        severity_labels = ["critical", "high", "medium", "low", "trivial"]
        for label in report.labels:
            if label.lower() in severity_labels:
                report.severity = label.lower()
                return

        # Infer from keywords
        content_lower = content.lower()
        if any(kw in content_lower for kw in ["crash", "data loss", "security", "vulnerability"]):
            report.severity = "critical"
        elif any(kw in content_lower for kw in ["broken", "cannot", "fails", "blocked"]):
            report.severity = "high"
        elif any(kw in content_lower for kw in ["degraded", "slow", "workaround"]):
            report.severity = "medium"

    def _generate_bug_id(self, title: str) -> str:
        """Generate a bug ID from title."""
        import hashlib
        hash_val = hashlib.md5(title.encode()).hexdigest()[:6].upper()
        return f"BUG-{hash_val}"


def parse_bug_report(file_path: str, format_type: Optional[str] = None) -> BugReport:
    """Convenience function to parse a bug report file."""
    parser = MarkdownParser()
    return parser.parse(file_path, format_type)


if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: parse_markdown.py <bug-report.md> [--format github|linear|bugzilla]")
        sys.exit(1)

    file_path = sys.argv[1]
    format_type = None

    if "--format" in sys.argv:
        idx = sys.argv.index("--format")
        if idx + 1 < len(sys.argv):
            format_type = sys.argv[idx + 1]

    report = parse_bug_report(file_path, format_type)
    print(json.dumps(report.to_dict(), indent=2))
