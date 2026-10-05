#!/usr/bin/env python3
"""
Bug Report Processor - Main Entry Point

Processes bug report markdown files from any ticket system, extracts
structured data, analyzes severity, and creates JSON state files
for tracking through the Detective Methodology workflow.
"""

import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional

from parse_markdown import parse_bug_report, BugReport
from parse_stack_trace import parse_stack_trace
from state_manager import StateManager, DEFAULT_STATE_DIR
from severity_analyzer import analyze_severity
from screenshot_ocr import ScreenshotOCR


class BugProcessor:
    """Main processor for bug reports."""

    def __init__(self, state_dir: Optional[str] = None):
        """Initialize processor."""
        self.state_dir = state_dir or DEFAULT_STATE_DIR
        self.state_manager = StateManager(self.state_dir)
        self.ocr = ScreenshotOCR()

    def process(self, file_path: str, format_type: Optional[str] = None) -> dict:
        """Process a bug report file and create state."""
        result = {
            "success": False,
            "bug_id": "",
            "file": file_path,
            "state_file": "",
            "summary": {},
            "errors": [],
            "warnings": [],
        }

        # Validate file exists
        if not os.path.exists(file_path):
            result["errors"].append(f"File not found: {file_path}")
            return result

        try:
            # Parse markdown
            report = parse_bug_report(file_path, format_type)
            result["bug_id"] = report.bug_id

            # Check if already processed
            if self.state_manager.exists(report.bug_id):
                result["warnings"].append(f"Bug {report.bug_id} already exists, updating...")
                state = self.state_manager.load(report.bug_id)
            else:
                state = None

            # Analyze stack traces
            error_analysis = self._analyze_stack_traces(report)

            # Analyze screenshots
            screenshot_data = self._analyze_screenshots(report, result)

            # Analyze severity
            bug_data = report.to_dict()
            bug_data["error_analysis"] = error_analysis
            severity_assessment = analyze_severity(bug_data)

            # Update severity if auto-detected is different
            if severity_assessment.confidence > 0.5:
                if report.severity == "medium":  # Default wasn't explicitly set
                    report.severity = severity_assessment.severity
                    report.priority = severity_assessment.priority

            # Prepare state data
            state_data = self._prepare_state_data(report, error_analysis, screenshot_data, severity_assessment)

            # Create or update state
            if state:
                self.state_manager.update(report.bug_id, state_data)
            else:
                self.state_manager.create(report.bug_id, state_data)

            # Get state file path
            state_file = os.path.join(self.state_dir, f"{report.bug_id}.json")
            result["state_file"] = state_file

            # Generate summary
            result["summary"] = self._generate_summary(report, severity_assessment)
            result["success"] = True

        except Exception as e:
            result["errors"].append(str(e))

        return result

    def _analyze_stack_traces(self, report: BugReport) -> dict:
        """Analyze stack traces from bug report."""
        error_analysis = {
            "error_type": "",
            "error_message": "",
            "stack_trace": [],
            "likely_cause": "",
        }

        for trace_info in report.stack_traces:
            trace_content = trace_info.get("content", "")
            if trace_content:
                analysis = parse_stack_trace(trace_content)
                error_analysis["error_type"] = analysis.error_type
                error_analysis["error_message"] = analysis.error_message
                error_analysis["stack_trace"] = [
                    {
                        "frame_number": f.frame_number,
                        "file": f.file,
                        "line": f.line,
                        "function": f.function,
                    }
                    for f in analysis.stack_trace
                ]
                if analysis.likely_point_of_failure:
                    error_analysis["likely_cause"] = analysis.likely_point_of_failure.get("reason", "")
                break  # Use first stack trace

        return error_analysis

    def _analyze_screenshots(self, report: BugReport, result: dict) -> list:
        """Analyze screenshots with OCR."""
        screenshot_data = []

        for screenshot in report.screenshots:
            img_path = screenshot.get("path", "")
            if img_path and os.path.exists(img_path):
                ocr_result = self.ocr.process(img_path)
                if ocr_result.processed:
                    screenshot_data.append({
                        "filename": screenshot.get("filename", ""),
                        "description": screenshot.get("description", ""),
                        "extracted_text": ocr_result.extracted_text[:500],  # Limit
                        "error_messages": ocr_result.error_messages,
                    })
                elif ocr_result.error:
                    result["warnings"].append(f"OCR failed for {img_path}: {ocr_result.error}")
            else:
                result["warnings"].append(f"Screenshot not found: {img_path}")

        return screenshot_data

    def _prepare_state_data(self, report: BugReport, error_analysis: dict,
                           screenshot_data: list, severity: dict) -> dict:
        """Prepare data for state file creation."""
        return {
            "bug_id": report.bug_id,
            "title": report.title,
            "type": "bug",
            "severity": report.severity,
            "priority": report.priority,
            "status": "new",
            "metadata": {
                "reporter": report.reporter,
                "assignee": report.assignee,
                "labels": report.labels,
                "affected_versions": report.affected_versions,
                "target_fix_version": report.target_fix_version,
                "regression": report.is_regression,
                "source_file": report.source_file,
                "source_format": report.source_format,
            },
            "description": {
                "summary": report.description,
                "observed_behavior": report.observed_behavior,
                "expected_behavior": report.expected_behavior,
                "additional_context": report.additional_context,
            },
            "reproduction": {
                "steps": report.reproduction_steps,
                "reproduction_rate": report.reproduction_rate,
                "automated_reproduction": {
                    "possible": len(report.reproduction_steps) > 0,
                    "status": "not_attempted",
                }
            },
            "environment": report.environment,
            "error_analysis": error_analysis,
            "screenshots": screenshot_data,
            "detective_state": {
                "current_phase": "new",
                "phases_completed": [],
                "blockers": [],
                "related_bugs": report.related_issues,
            },
        }

    def _generate_summary(self, report: BugReport, severity_assessment) -> dict:
        """Generate processing summary."""
        return {
            "bug_id": report.bug_id,
            "title": report.title,
            "severity": report.severity,
            "priority": report.priority,
            "format_detected": report.source_format,
            "reproduction_steps": len(report.reproduction_steps),
            "has_stack_trace": len(report.stack_traces) > 0,
            "has_screenshots": len(report.screenshots) > 0,
            "severity_confidence": severity_assessment.confidence,
            "severity_factors": severity_assessment.factors[:3] if severity_assessment.factors else [],
            "is_regression": report.is_regression,
        }

    def get_status(self, bug_id: str) -> dict:
        """Get status of a processed bug."""
        state = self.state_manager.load(bug_id)
        if state is None:
            return {"error": f"Bug {bug_id} not found"}

        return self.state_manager.get_status_summary(bug_id)

    def list_bugs(self, status: Optional[str] = None, severity: Optional[str] = None) -> list:
        """List processed bugs."""
        return self.state_manager.list_bugs(status, severity)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Bug Report Processor - Process bug reports from markdown files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s bug-report.md                  Process a bug report
  %(prog)s bug-report.md --format github  Specify format explicitly
  %(prog)s --status BUG-123               Check bug status
  %(prog)s --list                         List all bugs
  %(prog)s --list --severity critical     List critical bugs
        """
    )

    parser.add_argument("file", nargs="?", help="Bug report markdown file to process")
    parser.add_argument("--format", choices=["github", "linear", "bugzilla", "generic"],
                       help="Bug report format (auto-detected if not specified)")
    parser.add_argument("--status", metavar="BUG_ID", help="Check status of a bug")
    parser.add_argument("--list", action="store_true", help="List all processed bugs")
    parser.add_argument("--severity", help="Filter by severity (with --list)")
    parser.add_argument("--filter-status", help="Filter by status (with --list)")
    parser.add_argument("--state-dir", default=DEFAULT_STATE_DIR, help="State directory")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    processor = BugProcessor(args.state_dir)

    # Handle different modes
    if args.status:
        result = processor.get_status(args.status)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            _print_status(result)

    elif args.list:
        bugs = processor.list_bugs(args.filter_status, args.severity)
        if args.json:
            print(json.dumps(bugs, indent=2))
        else:
            _print_bug_list(bugs)

    elif args.file:
        result = processor.process(args.file, args.format)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            _print_process_result(result)

    else:
        parser.print_help()
        sys.exit(1)


def _print_status(status: dict):
    """Print bug status in readable format."""
    if "error" in status:
        print(f"Error: {status['error']}")
        return

    print(f"\n{'='*60}")
    print(f"Bug ID: {status.get('bug_id', 'N/A')}")
    print(f"Title: {status.get('title', 'N/A')}")
    print(f"{'='*60}")
    print(f"Severity: {status.get('severity', 'N/A')}")
    print(f"Status: {status.get('status', 'N/A')}")
    print(f"Current Phase: {status.get('current_phase', 'N/A')}")
    print(f"Phases Completed: {', '.join(status.get('phases_completed', [])) or 'None'}")
    print(f"Has Root Cause: {'Yes' if status.get('has_root_cause') else 'No'}")
    print(f"Hypotheses: {status.get('hypothesis_count', 0)}")
    print(f"Notes: {status.get('notes_count', 0)}")
    print()


def _print_bug_list(bugs: list):
    """Print bug list in readable format."""
    if not bugs:
        print("No bugs found.")
        return

    print(f"\n{'ID':<15} {'Title':<40} {'Severity':<10} {'Status':<15}")
    print("-" * 80)

    for bug in bugs:
        bug_id = bug.get("bug_id", "N/A")[:14]
        title = bug.get("title", "N/A")[:39]
        severity = bug.get("severity", "N/A")
        status = bug.get("status", "N/A")
        print(f"{bug_id:<15} {title:<40} {severity:<10} {status:<15}")

    print(f"\nTotal: {len(bugs)} bugs")


def _print_process_result(result: dict):
    """Print processing result in readable format."""
    if result["success"]:
        print(f"\n{'='*60}")
        print(f"Successfully processed bug report")
        print(f"{'='*60}")
        print(f"Bug ID: {result['bug_id']}")
        print(f"State File: {result['state_file']}")
        print()

        summary = result.get("summary", {})
        print("Summary:")
        print(f"  Title: {summary.get('title', 'N/A')}")
        print(f"  Severity: {summary.get('severity', 'N/A')} (confidence: {summary.get('severity_confidence', 0):.0%})")
        print(f"  Priority: {summary.get('priority', 'N/A')}")
        print(f"  Format: {summary.get('format_detected', 'N/A')}")
        print(f"  Reproduction Steps: {summary.get('reproduction_steps', 0)}")
        print(f"  Has Stack Trace: {'Yes' if summary.get('has_stack_trace') else 'No'}")
        print(f"  Has Screenshots: {'Yes' if summary.get('has_screenshots') else 'No'}")
        print(f"  Is Regression: {'Yes' if summary.get('is_regression') else 'No'}")

        if summary.get("severity_factors"):
            print("\n  Severity Factors:")
            for factor in summary["severity_factors"]:
                print(f"    - {factor}")

        if result.get("warnings"):
            print("\nWarnings:")
            for warning in result["warnings"]:
                print(f"  - {warning}")

        print()
    else:
        print(f"\nFailed to process bug report")
        for error in result.get("errors", []):
            print(f"  Error: {error}")


if __name__ == "__main__":
    main()
