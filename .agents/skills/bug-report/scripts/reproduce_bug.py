#!/usr/bin/env python3
"""
Bug Reproduction System

Attempts to automatically reproduce bugs based on reproduction steps
from bug reports. Supports UI automation via Selenium/Playwright
and API testing.
"""

import os
import re
import subprocess
import json
from datetime import datetime
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

from state_manager import StateManager, DEFAULT_STATE_DIR


@dataclass
class ReproductionStep:
    """Single reproduction step."""
    step_number: int = 0
    description: str = ""
    automatable: bool = False
    automation_type: str = ""  # ui, api, cli, manual
    automation_command: str = ""
    expected_result: str = ""
    actual_result: str = ""
    execution_status: str = "pending"  # pending, success, failure, skipped
    screenshot: str = ""
    error: str = ""


@dataclass
class ReproductionResult:
    """Result of reproduction attempt."""
    bug_id: str = ""
    status: str = "not_attempted"  # not_attempted, reproducing, reproduced, cannot_reproduce, needs_manual
    started_at: str = ""
    completed_at: str = ""
    steps: list = field(default_factory=list)
    evidence: dict = field(default_factory=dict)
    environment_match: bool = True
    environment_notes: str = ""
    error: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "bug_id": self.bug_id,
            "status": self.status,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "steps": [
                {
                    "step_number": s.step_number,
                    "description": s.description,
                    "automatable": s.automatable,
                    "automation_type": s.automation_type,
                    "expected_result": s.expected_result,
                    "actual_result": s.actual_result,
                    "execution_status": s.execution_status,
                    "error": s.error,
                }
                for s in self.steps
            ],
            "evidence": self.evidence,
            "environment_match": self.environment_match,
            "environment_notes": self.environment_notes,
            "error": self.error,
        }


class BugReproducer:
    """Attempts to reproduce bugs automatically."""

    # Patterns for identifying automatable steps
    UI_PATTERNS = [
        (r"(?:click|tap|press)\s+(?:on\s+)?(?:the\s+)?['\"]?(.+?)['\"]?\s*(?:button|link|element)?", "click"),
        (r"(?:open|navigate|go)\s+(?:to\s+)?(?:the\s+)?(.+?)(?:\s+page)?$", "navigate"),
        (r"(?:enter|type|input|fill)\s+['\"]?(.+?)['\"]?\s+(?:in|into)\s+(.+)", "input"),
        (r"(?:select|choose)\s+['\"]?(.+?)['\"]?\s+(?:from|in)\s+(.+)", "select"),
        (r"(?:wait|pause)\s+(?:for\s+)?(\d+)\s*(?:seconds?|s)", "wait"),
        (r"(?:scroll|swipe)\s+(?:to\s+)?(.+)", "scroll"),
    ]

    API_PATTERNS = [
        (r"(?:send|make)\s+(?:a\s+)?(GET|POST|PUT|DELETE|PATCH)\s+(?:request\s+)?(?:to\s+)?(.+)", "request"),
        (r"(?:call|invoke)\s+(?:the\s+)?(?:API\s+)?(?:endpoint\s+)?(.+)", "api_call"),
    ]

    CLI_PATTERNS = [
        (r"(?:run|execute)\s+(?:command\s+)?['\"`](.+?)['\"`]", "command"),
        (r"(?:run|execute)\s+(?:the\s+)?(?:command\s+)?(\S+.*)", "command"),
    ]

    def __init__(self, state_dir: Optional[str] = None):
        """Initialize reproducer."""
        self.state_manager = StateManager(state_dir or DEFAULT_STATE_DIR)
        self.evidence_dir = Path(state_dir or DEFAULT_STATE_DIR) / "evidence"
        self.evidence_dir.mkdir(parents=True, exist_ok=True)

    def _now(self) -> str:
        """Get current ISO timestamp."""
        return datetime.now().isoformat()

    def analyze_steps(self, steps: list) -> list:
        """Analyze reproduction steps for automation potential."""
        analyzed = []

        for i, step in enumerate(steps):
            repro_step = ReproductionStep()
            repro_step.step_number = i + 1
            repro_step.description = step if isinstance(step, str) else str(step)

            # Check for UI automation
            for pattern, action_type in self.UI_PATTERNS:
                match = re.search(pattern, repro_step.description, re.IGNORECASE)
                if match:
                    repro_step.automatable = True
                    repro_step.automation_type = "ui"
                    repro_step.automation_command = self._generate_ui_command(action_type, match)
                    break

            # Check for API automation
            if not repro_step.automatable:
                for pattern, action_type in self.API_PATTERNS:
                    match = re.search(pattern, repro_step.description, re.IGNORECASE)
                    if match:
                        repro_step.automatable = True
                        repro_step.automation_type = "api"
                        repro_step.automation_command = self._generate_api_command(action_type, match)
                        break

            # Check for CLI automation
            if not repro_step.automatable:
                for pattern, action_type in self.CLI_PATTERNS:
                    match = re.search(pattern, repro_step.description, re.IGNORECASE)
                    if match:
                        repro_step.automatable = True
                        repro_step.automation_type = "cli"
                        repro_step.automation_command = match.group(1)
                        break

            # Default to manual
            if not repro_step.automatable:
                repro_step.automation_type = "manual"

            analyzed.append(repro_step)

        return analyzed

    def _generate_ui_command(self, action_type: str, match: re.Match) -> str:
        """Generate UI automation command placeholder."""
        if action_type == "click":
            return f"# Click: {match.group(1)}"
        elif action_type == "navigate":
            return f"# Navigate to: {match.group(1)}"
        elif action_type == "input":
            return f"# Input '{match.group(1)}' into {match.group(2)}"
        elif action_type == "select":
            return f"# Select '{match.group(1)}' from {match.group(2)}"
        elif action_type == "wait":
            return f"time.sleep({match.group(1)})"
        elif action_type == "scroll":
            return f"# Scroll to: {match.group(1)}"
        return f"# {action_type}: {match.group(0)}"

    def _generate_api_command(self, action_type: str, match: re.Match) -> str:
        """Generate API command placeholder."""
        if action_type == "request":
            method = match.group(1).upper()
            url = match.group(2)
            return f"requests.{method.lower()}('{url}')"
        return f"# API call: {match.group(0)}"

    def reproduce(self, bug_id: str, auto_execute: bool = False) -> ReproductionResult:
        """Attempt to reproduce a bug."""
        result = ReproductionResult()
        result.bug_id = bug_id
        result.started_at = self._now()
        result.status = "reproducing"

        # Load bug state
        state = self.state_manager.load(bug_id)
        if state is None:
            result.status = "error"
            result.error = f"Bug {bug_id} not found"
            return result

        # Get reproduction steps
        repro_data = state.reproduction
        steps = repro_data.get("steps", [])

        if not steps:
            result.status = "needs_manual"
            result.error = "No reproduction steps found"
            return result

        # Analyze steps
        result.steps = self.analyze_steps(steps)

        # Check environment match
        result.environment_match, result.environment_notes = self._check_environment(state.environment)

        if auto_execute:
            # Execute automatable steps
            self._execute_steps(result)
        else:
            # Just mark as analyzed, needs manual verification
            has_automatable = any(s.automatable for s in result.steps)
            if has_automatable:
                result.status = "needs_manual"
                result.error = "Steps analyzed. Run with --auto to execute automatable steps."
            else:
                result.status = "needs_manual"
                result.error = "All steps require manual execution."

        result.completed_at = self._now()

        # Update state with reproduction results
        self._update_state(bug_id, result)

        return result

    def _check_environment(self, env: dict) -> tuple:
        """Check if current environment matches bug environment."""
        notes = []
        match = True

        # Check OS
        import platform
        current_os = platform.system()
        bug_os = env.get("os", "").lower()

        if bug_os and current_os.lower() not in bug_os:
            notes.append(f"OS mismatch: bug on '{bug_os}', current: '{current_os}'")
            match = False

        # Check Python version if applicable
        if "python" in str(env).lower():
            import sys
            current_py = f"{sys.version_info.major}.{sys.version_info.minor}"
            notes.append(f"Current Python version: {current_py}")

        if not notes:
            notes.append("Environment check passed")

        return match, "; ".join(notes)

    def _execute_steps(self, result: ReproductionResult):
        """Execute automatable reproduction steps."""
        all_passed = True
        bug_reproduced = False

        for step in result.steps:
            if not step.automatable or step.automation_type == "manual":
                step.execution_status = "skipped"
                continue

            try:
                if step.automation_type == "cli":
                    # Execute CLI command
                    output = subprocess.run(
                        step.automation_command,
                        shell=True,
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    step.actual_result = output.stdout + output.stderr
                    step.execution_status = "success" if output.returncode == 0 else "failure"

                    if output.returncode != 0:
                        bug_reproduced = True  # Error indicates bug may be reproduced

                else:
                    # UI/API automation requires additional setup
                    step.execution_status = "skipped"
                    step.error = f"{step.automation_type} automation not configured"

            except subprocess.TimeoutExpired:
                step.execution_status = "failure"
                step.error = "Command timed out"
                all_passed = False

            except Exception as e:
                step.execution_status = "failure"
                step.error = str(e)
                all_passed = False

        # Determine final status
        if bug_reproduced:
            result.status = "reproduced"
        elif all_passed:
            result.status = "cannot_reproduce"
        else:
            result.status = "needs_manual"

    def _update_state(self, bug_id: str, result: ReproductionResult):
        """Update bug state with reproduction results."""
        updates = {
            "reproduction": {
                "automated_reproduction": {
                    "last_attempt": result.started_at,
                    "status": result.status,
                    "evidence": result.evidence,
                }
            }
        }

        if result.status == "reproduced":
            updates["status"] = "reproduced"
            self.state_manager.advance_phase(bug_id, "investigate")
        elif result.status == "cannot_reproduce":
            updates["status"] = "cannot_reproduce"

        self.state_manager.update(bug_id, updates)

    def generate_manual_guide(self, bug_id: str) -> str:
        """Generate a manual reproduction guide."""
        state = self.state_manager.load(bug_id)
        if state is None:
            return f"Bug {bug_id} not found"

        repro_data = state.reproduction
        steps = repro_data.get("steps", [])

        lines = [
            f"# Manual Reproduction Guide for {bug_id}",
            "",
            f"**Title**: {state.title}",
            f"**Severity**: {state.severity}",
            "",
            "## Environment Requirements",
        ]

        for key, value in state.environment.items():
            lines.append(f"- **{key}**: {value}")

        lines.extend([
            "",
            "## Reproduction Steps",
        ])

        for i, step in enumerate(steps, 1):
            lines.append(f"{i}. {step}")

        lines.extend([
            "",
            "## Expected Behavior",
            state.description.get("expected_behavior", "Not specified"),
            "",
            "## Actual Behavior",
            state.description.get("observed_behavior", "Not specified"),
            "",
            "## Verification",
            "After following the steps above, verify:",
            "- [ ] Bug is reproduced",
            "- [ ] Environment matches",
            "- [ ] Screenshots captured",
        ])

        return "\n".join(lines)


def reproduce_bug(bug_id: str, auto_execute: bool = False, state_dir: Optional[str] = None) -> ReproductionResult:
    """Convenience function to reproduce a bug."""
    reproducer = BugReproducer(state_dir)
    return reproducer.reproduce(bug_id, auto_execute)


if __name__ == "__main__":
    import sys
    import argparse

    parser = argparse.ArgumentParser(description="Bug Reproduction System")
    parser.add_argument("bug_id", help="Bug ID to reproduce")
    parser.add_argument("--auto", action="store_true", help="Auto-execute automatable steps")
    parser.add_argument("--guide", action="store_true", help="Generate manual reproduction guide")
    parser.add_argument("--state-dir", default=DEFAULT_STATE_DIR, help="State directory")

    args = parser.parse_args()

    reproducer = BugReproducer(args.state_dir)

    if args.guide:
        guide = reproducer.generate_manual_guide(args.bug_id)
        print(guide)
    else:
        result = reproducer.reproduce(args.bug_id, args.auto)
        print(json.dumps(result.to_dict(), indent=2))
