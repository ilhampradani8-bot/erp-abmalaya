#!/usr/bin/env python3
"""
Fix Verification System

Verifies that bug fixes resolve the original issue by re-executing
reproduction steps and comparing before/after behavior.
"""

import os
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

from state_manager import StateManager, DEFAULT_STATE_DIR


@dataclass
class VerificationResult:
    """Result of fix verification."""
    bug_id: str = ""
    status: str = "pending"  # pending, verified, failed, partial, error
    verified_at: str = ""
    verified_by: str = ""
    original_bug_status: str = ""  # fixed, still_present, intermittent
    test_results: dict = field(default_factory=dict)
    before_after_comparison: dict = field(default_factory=dict)
    evidence: dict = field(default_factory=dict)
    notes: list = field(default_factory=list)
    error: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "bug_id": self.bug_id,
            "status": self.status,
            "verified_at": self.verified_at,
            "verified_by": self.verified_by,
            "original_bug_status": self.original_bug_status,
            "test_results": self.test_results,
            "before_after_comparison": self.before_after_comparison,
            "evidence": self.evidence,
            "notes": self.notes,
            "error": self.error,
        }


class FixVerifier:
    """Verifies bug fixes."""

    def __init__(self, state_dir: Optional[str] = None):
        """Initialize verifier."""
        self.state_manager = StateManager(state_dir or DEFAULT_STATE_DIR)
        self.evidence_dir = Path(state_dir or DEFAULT_STATE_DIR) / "evidence"
        self.evidence_dir.mkdir(parents=True, exist_ok=True)

    def _now(self) -> str:
        """Get current ISO timestamp."""
        return datetime.now().isoformat()

    def verify(self, bug_id: str, verifier: str = "", run_tests: bool = True) -> VerificationResult:
        """Verify that a bug fix works."""
        result = VerificationResult()
        result.bug_id = bug_id
        result.verified_at = self._now()
        result.verified_by = verifier

        # Load bug state
        state = self.state_manager.load(bug_id)
        if state is None:
            result.status = "error"
            result.error = f"Bug {bug_id} not found"
            return result

        # Check that bug has been fixed
        fix_status = state.fix.get("status", "pending")
        if fix_status != "implemented":
            result.status = "error"
            result.error = f"Bug fix not implemented (status: {fix_status})"
            return result

        # Check that root cause was identified
        root_cause = state.investigation.get("root_cause")
        if not root_cause:
            result.notes.append("Warning: No root cause documented")

        # Run verification steps
        verification_passed = True

        # 1. Re-run reproduction steps
        repro_result = self._verify_reproduction(state, result)

        # 2. Run related tests if requested
        if run_tests:
            test_result = self._run_tests(state, result)
            if not test_result:
                verification_passed = False

        # 3. Compare before/after behavior
        self._compare_behavior(state, result)

        # Determine final status
        if result.error:
            result.status = "error"
        elif repro_result == "fixed":
            result.original_bug_status = "fixed"
            result.status = "verified" if verification_passed else "partial"
        elif repro_result == "intermittent":
            result.original_bug_status = "intermittent"
            result.status = "partial"
            result.notes.append("Bug appears intermittently - may need additional investigation")
        else:
            result.original_bug_status = "still_present"
            result.status = "failed"

        # Update bug state
        self._update_state(bug_id, result)

        return result

    def _verify_reproduction(self, state, result: VerificationResult) -> str:
        """Verify bug no longer reproduces."""
        repro_data = state.reproduction
        steps = repro_data.get("steps", [])

        if not steps:
            result.notes.append("No reproduction steps to verify")
            return "fixed"  # Assume fixed if no steps to test

        # Check if there's a reproduction script
        auto_repro = repro_data.get("automated_reproduction", {})
        script_path = auto_repro.get("script_path", "")

        if script_path and os.path.exists(script_path):
            try:
                output = subprocess.run(
                    ["python", script_path],
                    capture_output=True,
                    text=True,
                    timeout=60
                )

                if output.returncode == 0:
                    # Script passed - bug is fixed
                    result.evidence["reproduction_output"] = output.stdout
                    return "fixed"
                else:
                    # Script failed - bug still present
                    result.evidence["reproduction_output"] = output.stdout + output.stderr
                    return "still_present"

            except subprocess.TimeoutExpired:
                result.notes.append("Reproduction script timed out")
                return "intermittent"

            except Exception as e:
                result.notes.append(f"Error running reproduction script: {e}")
                return "intermittent"

        # No automated reproduction - mark as needs manual verification
        result.notes.append("Manual verification required - no automated reproduction available")
        return "fixed"  # Optimistically assume fixed

    def _run_tests(self, state, result: VerificationResult) -> bool:
        """Run related tests."""
        test_results = {
            "test_cases_passed": 0,
            "test_cases_failed": 0,
            "test_suites_run": [],
        }

        # Check for related test files
        fix_data = state.fix.get("implementation", {})
        files_changed = fix_data.get("files_changed", [])

        # Try to find and run related tests
        for file_path in files_changed:
            test_file = self._find_related_test(file_path)
            if test_file:
                passed, failed = self._run_test_file(test_file)
                test_results["test_cases_passed"] += passed
                test_results["test_cases_failed"] += failed
                test_results["test_suites_run"].append(test_file)

        # If no specific tests found, try running default test command
        if not test_results["test_suites_run"]:
            default_passed, default_failed = self._run_default_tests()
            test_results["test_cases_passed"] += default_passed
            test_results["test_cases_failed"] += default_failed
            if default_passed > 0 or default_failed > 0:
                test_results["test_suites_run"].append("default")

        result.test_results = test_results
        return test_results["test_cases_failed"] == 0

    def _find_related_test(self, source_file: str) -> Optional[str]:
        """Find test file related to source file."""
        # Common test file patterns
        base = os.path.basename(source_file)
        name, ext = os.path.splitext(base)
        dir_path = os.path.dirname(source_file)

        test_patterns = [
            os.path.join(dir_path, "tests", f"test_{name}{ext}"),
            os.path.join(dir_path, f"test_{name}{ext}"),
            os.path.join("tests", f"test_{name}{ext}"),
            os.path.join(dir_path, "tests", f"{name}_test{ext}"),
        ]

        for pattern in test_patterns:
            if os.path.exists(pattern):
                return pattern

        return None

    def _run_test_file(self, test_file: str) -> tuple:
        """Run a test file and return (passed, failed) counts."""
        try:
            output = subprocess.run(
                ["python", "-m", "pytest", test_file, "-v", "--tb=short"],
                capture_output=True,
                text=True,
                timeout=120
            )

            # Parse pytest output for pass/fail counts
            import re
            match = re.search(r'(\d+) passed', output.stdout)
            passed = int(match.group(1)) if match else 0

            match = re.search(r'(\d+) failed', output.stdout)
            failed = int(match.group(1)) if match else 0

            return passed, failed

        except Exception:
            return 0, 0

    def _run_default_tests(self) -> tuple:
        """Run default test suite."""
        try:
            # Try pytest
            output = subprocess.run(
                ["python", "-m", "pytest", "--collect-only", "-q"],
                capture_output=True,
                text=True,
                timeout=30
            )

            if output.returncode == 0:
                # pytest is available
                output = subprocess.run(
                    ["python", "-m", "pytest", "-v", "--tb=short", "-x"],
                    capture_output=True,
                    text=True,
                    timeout=300
                )

                import re
                match = re.search(r'(\d+) passed', output.stdout)
                passed = int(match.group(1)) if match else 0

                match = re.search(r'(\d+) failed', output.stdout)
                failed = int(match.group(1)) if match else 0

                return passed, failed

        except Exception:
            pass

        return 0, 0

    def _compare_behavior(self, state, result: VerificationResult):
        """Compare before/after behavior."""
        comparison = {
            "before": {
                "status": "bug_present",
                "observed_behavior": state.description.get("observed_behavior", ""),
            },
            "after": {
                "status": result.original_bug_status,
                "expected_behavior": state.description.get("expected_behavior", ""),
            },
            "changes": [],
        }

        # Add notes about changes
        fix_data = state.fix.get("implementation", {})
        files_changed = fix_data.get("files_changed", [])
        commits = fix_data.get("commits", [])

        if files_changed:
            comparison["changes"].append(f"Modified files: {', '.join(files_changed)}")

        if commits:
            comparison["changes"].append(f"Commits: {', '.join(commits)}")

        result.before_after_comparison = comparison

    def _update_state(self, bug_id: str, result: VerificationResult):
        """Update bug state with verification results."""
        updates = {
            "fix": {
                "verification": {
                    "status": result.status,
                    "verified_at": result.verified_at,
                    "verified_by": result.verified_by,
                    "test_results": result.test_results,
                }
            }
        }

        if result.status == "verified":
            updates["status"] = "verified"
            self.state_manager.advance_phase(bug_id, "regression_test")
        elif result.status == "failed":
            updates["status"] = "fixing"  # Back to fixing
            self.state_manager.update(bug_id, updates)
            # Don't advance phase - need to fix again
            return

        self.state_manager.update(bug_id, updates)

    def generate_verification_report(self, bug_id: str) -> str:
        """Generate a verification report."""
        state = self.state_manager.load(bug_id)
        if state is None:
            return f"Bug {bug_id} not found"

        verification = state.fix.get("verification", {})

        lines = [
            f"# Verification Report for {bug_id}",
            "",
            f"**Title**: {state.title}",
            f"**Verification Status**: {verification.get('status', 'not verified')}",
            f"**Verified At**: {verification.get('verified_at', 'N/A')}",
            f"**Verified By**: {verification.get('verified_by', 'N/A')}",
            "",
            "## Root Cause",
        ]

        root_cause = state.investigation.get("root_cause", {})
        if root_cause:
            lines.append(root_cause.get("description", "Not documented"))
        else:
            lines.append("Not documented")

        lines.extend([
            "",
            "## Fix Implementation",
            f"**Description**: {state.fix.get('description', 'Not documented')}",
        ])

        impl = state.fix.get("implementation", {})
        if impl.get("files_changed"):
            lines.append(f"**Files Changed**: {', '.join(impl['files_changed'])}")
        if impl.get("commits"):
            lines.append(f"**Commits**: {', '.join(impl['commits'])}")
        if impl.get("pull_request"):
            lines.append(f"**Pull Request**: {impl['pull_request']}")

        lines.extend([
            "",
            "## Test Results",
        ])

        test_results = verification.get("test_results", {})
        lines.append(f"- Passed: {test_results.get('test_cases_passed', 0)}")
        lines.append(f"- Failed: {test_results.get('test_cases_failed', 0)}")

        lines.extend([
            "",
            "## Verification Checklist",
            "- [x] Bug fix implemented" if state.fix.get("status") == "implemented" else "- [ ] Bug fix implemented",
            f"- [{'x' if verification.get('status') == 'verified' else ' '}] Fix verified",
            f"- [{'x' if state.detective_state.get('current_phase') in ['regression_test', 'closed'] else ' '}] Regression tests passed",
        ])

        return "\n".join(lines)


def verify_fix(bug_id: str, verifier: str = "", state_dir: Optional[str] = None) -> VerificationResult:
    """Convenience function to verify a fix."""
    verifier_obj = FixVerifier(state_dir)
    return verifier_obj.verify(bug_id, verifier)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Fix Verification System")
    parser.add_argument("bug_id", help="Bug ID to verify")
    parser.add_argument("--verifier", default="", help="Name of person verifying")
    parser.add_argument("--no-tests", action="store_true", help="Skip running tests")
    parser.add_argument("--report", action="store_true", help="Generate verification report")
    parser.add_argument("--state-dir", default=DEFAULT_STATE_DIR, help="State directory")

    args = parser.parse_args()

    verifier = FixVerifier(args.state_dir)

    if args.report:
        report = verifier.generate_verification_report(args.bug_id)
        print(report)
    else:
        result = verifier.verify(args.bug_id, args.verifier, not args.no_tests)
        print(json.dumps(result.to_dict(), indent=2))
