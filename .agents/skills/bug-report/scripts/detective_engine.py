#!/usr/bin/env python3
"""
Detective Workflow Engine

Orchestrates the systematic bug resolution process following the
Detective Methodology: Reproduce → Investigate → Diagnose → Fix → Verify → Regression Test
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

from state_manager import StateManager, BugState, DETECTIVE_PHASES, DEFAULT_STATE_DIR


@dataclass
class WorkflowStatus:
    """Status of the detective workflow."""
    total_bugs: int = 0
    bugs_by_phase: dict = field(default_factory=dict)
    bugs_by_severity: dict = field(default_factory=dict)
    current_bug: Optional[str] = None
    next_action: str = ""
    blockers: list = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "total_bugs": self.total_bugs,
            "bugs_by_phase": self.bugs_by_phase,
            "bugs_by_severity": self.bugs_by_severity,
            "current_bug": self.current_bug,
            "next_action": self.next_action,
            "blockers": self.blockers,
        }


class DetectiveEngine:
    """Orchestrates the detective methodology workflow."""

    # Phase requirements and transitions
    PHASE_REQUIREMENTS = {
        "new": {
            "required_before": [],
            "required_fields": [],
            "next_phase": "reproduce",
            "action": "Process bug report and analyze",
        },
        "reproduce": {
            "required_before": ["new"],
            "required_fields": ["reproduction.steps"],
            "next_phase": "investigate",
            "action": "Attempt to reproduce the bug",
        },
        "investigate": {
            "required_before": ["reproduce"],
            "required_fields": [],
            "next_phase": "diagnose",
            "action": "Investigate and gather evidence",
        },
        "diagnose": {
            "required_before": ["investigate"],
            "required_fields": ["investigation.hypothesis"],
            "next_phase": "fix",
            "action": "Identify root cause",
        },
        "fix": {
            "required_before": ["diagnose"],
            "required_fields": ["investigation.root_cause"],
            "next_phase": "verify",
            "action": "Implement fix",
        },
        "verify": {
            "required_before": ["fix"],
            "required_fields": ["fix.implementation.commits"],
            "next_phase": "regression_test",
            "action": "Verify fix resolves issue",
        },
        "regression_test": {
            "required_before": ["verify"],
            "required_fields": ["fix.verification.status"],
            "next_phase": "closed",
            "action": "Run regression tests",
        },
        "closed": {
            "required_before": ["regression_test"],
            "required_fields": ["regression_testing.status"],
            "next_phase": None,
            "action": "Bug resolved",
        },
    }

    # Severity order for prioritization
    SEVERITY_ORDER = ["critical", "high", "medium", "low", "trivial"]

    def __init__(self, state_dir: Optional[str] = None):
        """Initialize detective engine."""
        self.state_manager = StateManager(state_dir or DEFAULT_STATE_DIR)

    def _now(self) -> str:
        """Get current ISO timestamp."""
        return datetime.now().isoformat()

    def get_workflow_status(self) -> WorkflowStatus:
        """Get overall workflow status."""
        status = WorkflowStatus()

        bugs = self.state_manager.list_bugs()
        status.total_bugs = len(bugs)

        # Group by phase and severity
        for phase in DETECTIVE_PHASES:
            status.bugs_by_phase[phase] = []

        for severity in self.SEVERITY_ORDER:
            status.bugs_by_severity[severity] = []

        for bug in bugs:
            phase = bug.get("detective_state", {}).get("current_phase", "new")
            severity = bug.get("severity", "medium")

            if phase in status.bugs_by_phase:
                status.bugs_by_phase[phase].append(bug["bug_id"])
            if severity in status.bugs_by_severity:
                status.bugs_by_severity[severity].append(bug["bug_id"])

        # Find next bug to work on
        next_bug = self.get_next_bug()
        if next_bug:
            status.current_bug = next_bug.bug_id
            phase = next_bug.detective_state.get("current_phase", "new")
            status.next_action = self.PHASE_REQUIREMENTS.get(phase, {}).get("action", "Unknown")

        # Collect blockers
        for bug in bugs:
            blockers = bug.get("detective_state", {}).get("blockers", [])
            for blocker in blockers:
                status.blockers.append({
                    "bug_id": bug["bug_id"],
                    "blocker": blocker,
                })

        return status

    def get_next_bug(self) -> Optional[BugState]:
        """Get next bug to work on based on severity and phase."""
        bugs = self.state_manager.list_bugs()

        # Filter out closed bugs
        open_bugs = [
            b for b in bugs
            if b.get("status") not in ["closed", "wont_fix", "duplicate"]
        ]

        if not open_bugs:
            return None

        # Sort by severity first, then by phase (earlier phases first)
        def sort_key(bug):
            severity = bug.get("severity", "medium")
            severity_idx = self.SEVERITY_ORDER.index(severity) if severity in self.SEVERITY_ORDER else 2

            phase = bug.get("detective_state", {}).get("current_phase", "new")
            phase_idx = DETECTIVE_PHASES.index(phase) if phase in DETECTIVE_PHASES else 0

            return (severity_idx, phase_idx)

        open_bugs.sort(key=sort_key)

        return BugState.from_dict(open_bugs[0])

    def can_advance_phase(self, bug_id: str) -> tuple:
        """Check if bug can advance to next phase."""
        state = self.state_manager.load(bug_id)
        if state is None:
            return False, "Bug not found"

        current_phase = state.detective_state.get("current_phase", "new")
        requirements = self.PHASE_REQUIREMENTS.get(current_phase, {})
        next_phase = requirements.get("next_phase")

        if next_phase is None:
            return False, "Bug is already closed"

        # Check required fields for next phase
        required_fields = requirements.get("required_fields", [])
        missing = []

        for field_path in required_fields:
            if not self._check_field(state, field_path):
                missing.append(field_path)

        if missing:
            return False, f"Missing required fields: {', '.join(missing)}"

        return True, next_phase

    def _check_field(self, state: BugState, field_path: str) -> bool:
        """Check if a field exists and has a value."""
        parts = field_path.split(".")
        obj = state.to_dict()

        for part in parts:
            if isinstance(obj, dict) and part in obj:
                obj = obj[part]
            else:
                return False

        # Check if has value
        if obj is None:
            return False
        if isinstance(obj, (list, dict, str)) and len(obj) == 0:
            return False

        return True

    def advance_phase(self, bug_id: str) -> tuple:
        """Advance bug to next phase if requirements are met."""
        can_advance, result = self.can_advance_phase(bug_id)

        if not can_advance:
            return False, result

        next_phase = result
        self.state_manager.advance_phase(bug_id, next_phase)

        # Update status based on phase
        status_mapping = {
            "reproduce": "reproducing",
            "investigate": "investigating",
            "diagnose": "investigating",
            "fix": "fixing",
            "verify": "verifying",
            "regression_test": "regression_testing",
            "closed": "closed",
        }

        if next_phase in status_mapping:
            self.state_manager.update_status(bug_id, status_mapping[next_phase])

        return True, f"Advanced to phase: {next_phase}"

    def get_phase_guidance(self, phase: str) -> dict:
        """Get guidance for a specific phase."""
        guidance = {
            "new": {
                "description": "Bug has been reported but not yet processed",
                "actions": [
                    "Parse bug report for structured data",
                    "Extract reproduction steps",
                    "Identify severity and priority",
                    "Create initial state file",
                ],
                "tools": ["process_bug.py", "severity_analyzer.py"],
                "next_step": "Begin reproduction attempt",
            },
            "reproduce": {
                "description": "Attempting to reproduce the reported bug",
                "actions": [
                    "Follow reproduction steps exactly",
                    "Match environment as closely as possible",
                    "Capture evidence (screenshots, logs)",
                    "Document any variations in behavior",
                ],
                "tools": ["reproduce_bug.py"],
                "next_step": "If reproduced, begin investigation. If not, request more info.",
            },
            "investigate": {
                "description": "Gathering evidence and forming hypotheses",
                "actions": [
                    "Analyze error logs and stack traces",
                    "Review recent code changes",
                    "Form hypotheses about root cause",
                    "Test each hypothesis systematically",
                ],
                "tools": ["parse_stack_trace.py", "state_manager.py --hypothesis"],
                "next_step": "Document findings and identify root cause",
            },
            "diagnose": {
                "description": "Identifying the root cause",
                "actions": [
                    "Confirm hypothesis through testing",
                    "Identify the exact code/commit causing issue",
                    "Document root cause clearly",
                    "Plan fix approach",
                ],
                "tools": ["state_manager.py --root-cause"],
                "next_step": "Implement the fix",
            },
            "fix": {
                "description": "Implementing the fix",
                "actions": [
                    "Implement minimal fix for root cause",
                    "Avoid over-engineering",
                    "Write or update tests",
                    "Create commit/PR",
                ],
                "tools": [],
                "next_step": "Verify fix resolves the issue",
            },
            "verify": {
                "description": "Verifying the fix works",
                "actions": [
                    "Re-run reproduction steps",
                    "Confirm bug no longer occurs",
                    "Run related test cases",
                    "Document verification results",
                ],
                "tools": ["verify_fix.py"],
                "next_step": "Run regression tests",
            },
            "regression_test": {
                "description": "Ensuring fix doesn't break other functionality",
                "actions": [
                    "Identify related test suites",
                    "Run full regression suite",
                    "Compare results to baseline",
                    "Investigate any new failures",
                ],
                "tools": ["regression_tester.py"],
                "next_step": "If all pass, close bug. Otherwise, investigate regressions.",
            },
            "closed": {
                "description": "Bug has been resolved",
                "actions": [
                    "Document lessons learned",
                    "Update related documentation",
                    "Consider preventive measures",
                ],
                "tools": [],
                "next_step": "Move to next bug",
            },
        }

        return guidance.get(phase, {
            "description": "Unknown phase",
            "actions": [],
            "tools": [],
            "next_step": "Check phase status",
        })

    def run_workflow(self, bug_id: str, auto_advance: bool = False) -> dict:
        """Run workflow for a specific bug."""
        state = self.state_manager.load(bug_id)
        if state is None:
            return {"error": f"Bug {bug_id} not found"}

        current_phase = state.detective_state.get("current_phase", "new")
        guidance = self.get_phase_guidance(current_phase)

        result = {
            "bug_id": bug_id,
            "title": state.title,
            "severity": state.severity,
            "current_phase": current_phase,
            "status": state.status,
            "guidance": guidance,
            "can_advance": False,
            "advance_reason": "",
        }

        # Check if can advance
        can_advance, reason = self.can_advance_phase(bug_id)
        result["can_advance"] = can_advance
        result["advance_reason"] = reason

        if auto_advance and can_advance:
            success, msg = self.advance_phase(bug_id)
            result["advanced"] = success
            result["advance_message"] = msg

        return result

    def run_detective_mode(self, directory: str = ".", auto: bool = False) -> dict:
        """Run detective mode on a directory of bugs."""
        # Find and process all markdown bug reports
        bug_files = list(Path(directory).glob("**/*.md"))

        results = {
            "processed": [],
            "errors": [],
            "workflow_status": None,
        }

        # Process any new bug files
        from parse_markdown import parse_bug_report

        for bug_file in bug_files:
            try:
                # Skip non-bug files
                with open(bug_file, 'r') as f:
                    content = f.read()
                    if "## Steps to Reproduce" not in content and "## Reproduction Steps" not in content:
                        continue

                report = parse_bug_report(str(bug_file))

                # Check if already processed
                if not self.state_manager.exists(report.bug_id):
                    # Create new state
                    state = self.state_manager.create(report.bug_id, report.to_dict())
                    results["processed"].append(report.bug_id)

            except Exception as e:
                results["errors"].append({
                    "file": str(bug_file),
                    "error": str(e),
                })

        # Get workflow status
        results["workflow_status"] = self.get_workflow_status().to_dict()

        # If auto mode, advance bugs where possible
        if auto:
            bugs = self.state_manager.list_bugs()
            for bug in bugs:
                bug_id = bug["bug_id"]
                can_advance, _ = self.can_advance_phase(bug_id)
                if can_advance:
                    self.advance_phase(bug_id)

        return results

    def generate_summary(self) -> str:
        """Generate a summary of all bugs and workflow status."""
        status = self.get_workflow_status()

        lines = [
            "# Bug Detective Summary",
            "",
            f"**Total Bugs**: {status.total_bugs}",
            "",
            "## Bugs by Severity",
        ]

        for severity in self.SEVERITY_ORDER:
            bugs = status.bugs_by_severity.get(severity, [])
            if bugs:
                lines.append(f"- **{severity.upper()}**: {len(bugs)} ({', '.join(bugs[:5])}{'...' if len(bugs) > 5 else ''})")

        lines.extend([
            "",
            "## Bugs by Phase",
        ])

        for phase in DETECTIVE_PHASES:
            bugs = status.bugs_by_phase.get(phase, [])
            if bugs:
                lines.append(f"- **{phase}**: {len(bugs)}")

        if status.current_bug:
            lines.extend([
                "",
                "## Next Action",
                f"**Bug**: {status.current_bug}",
                f"**Action**: {status.next_action}",
            ])

        if status.blockers:
            lines.extend([
                "",
                "## Blockers",
            ])
            for blocker in status.blockers[:5]:
                lines.append(f"- {blocker['bug_id']}: {blocker['blocker']}")

        return "\n".join(lines)


def run_detective(bug_id: Optional[str] = None, state_dir: Optional[str] = None) -> dict:
    """Convenience function to run detective workflow."""
    engine = DetectiveEngine(state_dir)
    if bug_id:
        return engine.run_workflow(bug_id)
    else:
        return engine.get_workflow_status().to_dict()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Detective Workflow Engine")
    parser.add_argument("bug_id", nargs="?", help="Bug ID to work on")
    parser.add_argument("--directory", default=".", help="Directory to scan for bug reports")
    parser.add_argument("--auto", action="store_true", help="Auto-advance phases where possible")
    parser.add_argument("--status", action="store_true", help="Show workflow status")
    parser.add_argument("--summary", action="store_true", help="Generate summary report")
    parser.add_argument("--guidance", help="Show guidance for a specific phase")
    parser.add_argument("--state-dir", default=DEFAULT_STATE_DIR, help="State directory")

    args = parser.parse_args()

    engine = DetectiveEngine(args.state_dir)

    if args.summary:
        print(engine.generate_summary())
    elif args.status:
        status = engine.get_workflow_status()
        print(json.dumps(status.to_dict(), indent=2))
    elif args.guidance:
        guidance = engine.get_phase_guidance(args.guidance)
        print(json.dumps(guidance, indent=2))
    elif args.bug_id:
        result = engine.run_workflow(args.bug_id, args.auto)
        print(json.dumps(result, indent=2))
    else:
        result = engine.run_detective_mode(args.directory, args.auto)
        print(json.dumps(result, indent=2))
