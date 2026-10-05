#!/usr/bin/env python3
"""
Regression Testing Automation

Ensures bug fixes don't introduce new issues by running related
test suites and comparing results to baseline.
"""

import os
import json
import subprocess
import re
from datetime import datetime
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

from state_manager import StateManager, DEFAULT_STATE_DIR


@dataclass
class TestSuiteResult:
    """Result from running a test suite."""
    suite_name: str = ""
    tests_run: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    errors: int = 0
    duration_seconds: float = 0.0
    failed_tests: list = field(default_factory=list)
    error_tests: list = field(default_factory=list)
    output: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "suite": self.suite_name,
            "tests_run": self.tests_run,
            "passed": self.passed,
            "failed": self.failed,
            "skipped": self.skipped,
            "errors": self.errors,
            "duration_seconds": self.duration_seconds,
            "failed_tests": self.failed_tests,
            "error_tests": self.error_tests,
        }


@dataclass
class RegressionResult:
    """Result of regression testing."""
    bug_id: str = ""
    status: str = "pending"  # pending, passed, failed, error
    executed_at: str = ""
    test_suites: list = field(default_factory=list)
    new_issues_found: list = field(default_factory=list)
    baseline_comparison: dict = field(default_factory=dict)
    total_tests: int = 0
    total_passed: int = 0
    total_failed: int = 0
    error: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "bug_id": self.bug_id,
            "status": self.status,
            "executed_at": self.executed_at,
            "test_suites": [s.to_dict() for s in self.test_suites],
            "new_issues_found": self.new_issues_found,
            "baseline_comparison": self.baseline_comparison,
            "total_tests": self.total_tests,
            "total_passed": self.total_passed,
            "total_failed": self.total_failed,
            "error": self.error,
        }


class RegressionTester:
    """Runs regression tests and compares to baseline."""

    # Common test directories
    TEST_DIRS = ["tests", "test", "spec", "__tests__"]

    # Test file patterns
    TEST_FILE_PATTERNS = [
        "test_*.py",
        "*_test.py",
        "*.spec.js",
        "*.test.js",
        "*.spec.ts",
        "*.test.ts",
        "*Test.java",
    ]

    def __init__(self, state_dir: Optional[str] = None):
        """Initialize regression tester."""
        self.state_manager = StateManager(state_dir or DEFAULT_STATE_DIR)
        self.baseline_dir = Path(state_dir or DEFAULT_STATE_DIR) / "baselines"
        self.baseline_dir.mkdir(parents=True, exist_ok=True)

    def _now(self) -> str:
        """Get current ISO timestamp."""
        return datetime.now().isoformat()

    def run_regression_tests(self, bug_id: str, test_paths: Optional[list] = None) -> RegressionResult:
        """Run regression tests for a bug fix."""
        result = RegressionResult()
        result.bug_id = bug_id
        result.executed_at = self._now()

        # Load bug state
        state = self.state_manager.load(bug_id)
        if state is None:
            result.status = "error"
            result.error = f"Bug {bug_id} not found"
            return result

        # Check that fix is verified
        fix_verification = state.fix.get("verification", {})
        if fix_verification.get("status") != "verified":
            result.status = "error"
            result.error = "Fix not yet verified"
            return result

        # Determine which tests to run
        if test_paths is None:
            test_paths = self._find_related_tests(state)

        if not test_paths:
            # Run all tests
            test_paths = self._find_all_tests()

        if not test_paths:
            result.status = "error"
            result.error = "No test files found"
            return result

        # Load baseline if exists
        baseline = self._load_baseline(bug_id)

        # Run tests
        for test_path in test_paths:
            suite_result = self._run_test_suite(test_path)
            result.test_suites.append(suite_result)
            result.total_tests += suite_result.tests_run
            result.total_passed += suite_result.passed
            result.total_failed += suite_result.failed

        # Compare to baseline
        if baseline:
            result.baseline_comparison = self._compare_to_baseline(result, baseline)
            result.new_issues_found = result.baseline_comparison.get("new_failures", [])

        # Determine status
        if result.total_failed > 0:
            result.status = "failed"
        else:
            result.status = "passed"

        # Save as new baseline if passed
        if result.status == "passed":
            self._save_baseline(bug_id, result)

        # Update bug state
        self._update_state(bug_id, result)

        return result

    def _find_related_tests(self, state) -> list:
        """Find tests related to the bug fix."""
        test_paths = []

        # Get changed files
        fix_impl = state.fix.get("implementation", {})
        files_changed = fix_impl.get("files_changed", [])

        for file_path in files_changed:
            related = self._find_test_for_file(file_path)
            if related:
                test_paths.extend(related)

        return list(set(test_paths))

    def _find_test_for_file(self, source_file: str) -> list:
        """Find test files for a source file."""
        tests = []
        base = os.path.basename(source_file)
        name, ext = os.path.splitext(base)
        dir_path = os.path.dirname(source_file)

        # Python test patterns
        if ext == ".py":
            patterns = [
                os.path.join(dir_path, "tests", f"test_{name}.py"),
                os.path.join(dir_path, f"test_{name}.py"),
                os.path.join("tests", f"test_{name}.py"),
                os.path.join(dir_path, "tests", f"{name}_test.py"),
            ]
        # JavaScript/TypeScript test patterns
        elif ext in [".js", ".ts", ".jsx", ".tsx"]:
            patterns = [
                os.path.join(dir_path, "__tests__", f"{name}.test{ext}"),
                os.path.join(dir_path, f"{name}.test{ext}"),
                os.path.join(dir_path, f"{name}.spec{ext}"),
            ]
        # Java test patterns
        elif ext == ".java":
            patterns = [
                os.path.join(dir_path.replace("main", "test"), f"{name}Test.java"),
            ]
        else:
            patterns = []

        for pattern in patterns:
            if os.path.exists(pattern):
                tests.append(pattern)

        return tests

    def _find_all_tests(self) -> list:
        """Find all test files in the project."""
        tests = []

        for test_dir in self.TEST_DIRS:
            if os.path.isdir(test_dir):
                for pattern in self.TEST_FILE_PATTERNS:
                    tests.extend(str(p) for p in Path(test_dir).glob(f"**/{pattern}"))

        return tests

    def _run_test_suite(self, test_path: str) -> TestSuiteResult:
        """Run a test suite and parse results."""
        result = TestSuiteResult()
        result.suite_name = test_path

        # Determine test runner based on file extension
        ext = os.path.splitext(test_path)[1]

        try:
            if ext == ".py":
                result = self._run_pytest(test_path)
            elif ext in [".js", ".ts", ".jsx", ".tsx"]:
                result = self._run_jest(test_path)
            elif ext == ".java":
                result = self._run_junit(test_path)
            else:
                result.output = f"Unknown test type: {ext}"

        except Exception as e:
            result.errors = 1
            result.output = str(e)

        return result

    def _run_pytest(self, test_path: str) -> TestSuiteResult:
        """Run pytest and parse results."""
        result = TestSuiteResult()
        result.suite_name = test_path

        try:
            import time
            start_time = time.time()

            output = subprocess.run(
                ["python", "-m", "pytest", test_path, "-v", "--tb=short", "-q"],
                capture_output=True,
                text=True,
                timeout=300
            )

            result.duration_seconds = time.time() - start_time
            result.output = output.stdout + output.stderr

            # Parse pytest output
            # Look for "X passed, Y failed, Z skipped"
            summary_match = re.search(
                r'(\d+)\s+passed(?:.*?(\d+)\s+failed)?(?:.*?(\d+)\s+skipped)?',
                result.output
            )

            if summary_match:
                result.passed = int(summary_match.group(1) or 0)
                result.failed = int(summary_match.group(2) or 0)
                result.skipped = int(summary_match.group(3) or 0)
                result.tests_run = result.passed + result.failed + result.skipped

            # Extract failed test names
            failed_matches = re.findall(r'FAILED\s+(\S+)', result.output)
            result.failed_tests = failed_matches

        except subprocess.TimeoutExpired:
            result.errors = 1
            result.output = "Test suite timed out"

        except Exception as e:
            result.errors = 1
            result.output = str(e)

        return result

    def _run_jest(self, test_path: str) -> TestSuiteResult:
        """Run Jest and parse results."""
        result = TestSuiteResult()
        result.suite_name = test_path

        try:
            import time
            start_time = time.time()

            output = subprocess.run(
                ["npx", "jest", test_path, "--json"],
                capture_output=True,
                text=True,
                timeout=300
            )

            result.duration_seconds = time.time() - start_time

            # Parse JSON output
            try:
                jest_result = json.loads(output.stdout)
                result.tests_run = jest_result.get("numTotalTests", 0)
                result.passed = jest_result.get("numPassedTests", 0)
                result.failed = jest_result.get("numFailedTests", 0)
                result.skipped = jest_result.get("numPendingTests", 0)

                # Extract failed test names
                for suite in jest_result.get("testResults", []):
                    for test in suite.get("assertionResults", []):
                        if test.get("status") == "failed":
                            result.failed_tests.append(test.get("fullName", ""))

            except json.JSONDecodeError:
                result.output = output.stdout + output.stderr

        except subprocess.TimeoutExpired:
            result.errors = 1
            result.output = "Test suite timed out"

        except Exception as e:
            result.errors = 1
            result.output = str(e)

        return result

    def _run_junit(self, test_path: str) -> TestSuiteResult:
        """Run JUnit and parse results."""
        result = TestSuiteResult()
        result.suite_name = test_path
        result.output = "JUnit execution not implemented - use Maven or Gradle"
        return result

    def _load_baseline(self, bug_id: str) -> Optional[dict]:
        """Load baseline test results."""
        baseline_file = self.baseline_dir / f"{bug_id}_baseline.json"
        if baseline_file.exists():
            with open(baseline_file, 'r') as f:
                return json.load(f)
        return None

    def _save_baseline(self, bug_id: str, result: RegressionResult):
        """Save test results as baseline."""
        baseline_file = self.baseline_dir / f"{bug_id}_baseline.json"
        with open(baseline_file, 'w') as f:
            json.dump(result.to_dict(), f, indent=2)

    def _compare_to_baseline(self, result: RegressionResult, baseline: dict) -> dict:
        """Compare current results to baseline."""
        comparison = {
            "baseline_date": baseline.get("executed_at", "unknown"),
            "tests_diff": result.total_tests - baseline.get("total_tests", 0),
            "passed_diff": result.total_passed - baseline.get("total_passed", 0),
            "failed_diff": result.total_failed - baseline.get("total_failed", 0),
            "new_failures": [],
            "fixed_tests": [],
        }

        # Get baseline failed tests
        baseline_failed = set()
        for suite in baseline.get("test_suites", []):
            baseline_failed.update(suite.get("failed_tests", []))

        # Get current failed tests
        current_failed = set()
        for suite in result.test_suites:
            current_failed.update(suite.failed_tests)

        # Find new failures and fixed tests
        comparison["new_failures"] = list(current_failed - baseline_failed)
        comparison["fixed_tests"] = list(baseline_failed - current_failed)

        return comparison

    def _update_state(self, bug_id: str, result: RegressionResult):
        """Update bug state with regression test results."""
        updates = {
            "regression_testing": {
                "status": result.status,
                "executed_at": result.executed_at,
                "test_suites": [s.to_dict() for s in result.test_suites],
                "new_issues_found": result.new_issues_found,
            }
        }

        if result.status == "passed":
            updates["status"] = "verified"
            self.state_manager.advance_phase(bug_id, "closed")
        elif result.status == "failed":
            updates["status"] = "regression_testing"
            # Don't advance - need to investigate regressions

        self.state_manager.update(bug_id, updates)

    def generate_report(self, bug_id: str) -> str:
        """Generate regression test report."""
        state = self.state_manager.load(bug_id)
        if state is None:
            return f"Bug {bug_id} not found"

        regression = state.regression_testing

        lines = [
            f"# Regression Test Report for {bug_id}",
            "",
            f"**Status**: {regression.get('status', 'not run')}",
            f"**Executed At**: {regression.get('executed_at', 'N/A')}",
            "",
            "## Test Suites",
        ]

        for suite in regression.get("test_suites", []):
            lines.append(f"### {suite.get('suite', 'Unknown')}")
            lines.append(f"- Tests Run: {suite.get('tests_run', 0)}")
            lines.append(f"- Passed: {suite.get('passed', 0)}")
            lines.append(f"- Failed: {suite.get('failed', 0)}")
            lines.append(f"- Skipped: {suite.get('skipped', 0)}")

            if suite.get("failed_tests"):
                lines.append("- Failed Tests:")
                for test in suite["failed_tests"]:
                    lines.append(f"  - {test}")
            lines.append("")

        if regression.get("new_issues_found"):
            lines.extend([
                "## New Issues Found",
            ])
            for issue in regression["new_issues_found"]:
                lines.append(f"- {issue}")

        return "\n".join(lines)


def run_regression_tests(bug_id: str, state_dir: Optional[str] = None) -> RegressionResult:
    """Convenience function to run regression tests."""
    tester = RegressionTester(state_dir)
    return tester.run_regression_tests(bug_id)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Regression Testing Automation")
    parser.add_argument("bug_id", help="Bug ID to test")
    parser.add_argument("--tests", nargs="*", help="Specific test files to run")
    parser.add_argument("--report", action="store_true", help="Generate test report")
    parser.add_argument("--state-dir", default=DEFAULT_STATE_DIR, help="State directory")

    args = parser.parse_args()

    tester = RegressionTester(args.state_dir)

    if args.report:
        report = tester.generate_report(args.bug_id)
        print(report)
    else:
        result = tester.run_regression_tests(args.bug_id, args.tests)
        print(json.dumps(result.to_dict(), indent=2))
