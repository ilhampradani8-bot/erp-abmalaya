#!/usr/bin/env python3
"""
Bug State Manager

Manages JSON state files for bug tracking throughout the investigation
and resolution workflow.
"""

import os
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field


# Default state directory
DEFAULT_STATE_DIR = ".bug-states"

# Valid detective phases in order
DETECTIVE_PHASES = [
    "new",
    "reproduce",
    "investigate",
    "diagnose",
    "fix",
    "verify",
    "regression_test",
    "closed"
]

# Valid bug statuses
BUG_STATUSES = [
    "new",
    "reproducing",
    "reproduced",
    "cannot_reproduce",
    "needs_info",
    "investigating",
    "diagnosed",
    "fixing",
    "verifying",
    "verified",
    "regression_testing",
    "closed",
    "wont_fix",
    "duplicate"
]


@dataclass
class BugState:
    """Complete bug state representation."""
    bug_id: str = ""
    title: str = ""
    type: str = "bug"
    severity: str = "medium"
    priority: str = "normal"
    status: str = "new"
    created_at: str = ""
    updated_at: str = ""

    metadata: dict = field(default_factory=dict)
    description: dict = field(default_factory=dict)
    reproduction: dict = field(default_factory=dict)
    environment: dict = field(default_factory=dict)
    error_analysis: dict = field(default_factory=dict)
    screenshots: list = field(default_factory=list)
    investigation: dict = field(default_factory=dict)
    fix: dict = field(default_factory=dict)
    regression_testing: dict = field(default_factory=dict)
    detective_state: dict = field(default_factory=dict)
    resolution: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "bug_id": self.bug_id,
            "title": self.title,
            "type": self.type,
            "severity": self.severity,
            "priority": self.priority,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metadata": self.metadata,
            "description": self.description,
            "reproduction": self.reproduction,
            "environment": self.environment,
            "error_analysis": self.error_analysis,
            "screenshots": self.screenshots,
            "investigation": self.investigation,
            "fix": self.fix,
            "regression_testing": self.regression_testing,
            "detective_state": self.detective_state,
            "resolution": self.resolution,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "BugState":
        """Create BugState from dictionary."""
        state = cls()
        for key, value in data.items():
            if hasattr(state, key):
                setattr(state, key, value)
        return state


class StateManager:
    """Manages bug state files."""

    def __init__(self, state_dir: Optional[str] = None):
        """Initialize state manager."""
        # If no state directory provided, use DEFAULT_STATE_DIR in current working directory
        if state_dir is None:
            self.state_dir = Path(os.getcwd()) / DEFAULT_STATE_DIR
        else:
            # If provided path is relative, resolve it relative to current working directory
            state_path = Path(state_dir)
            if not state_path.is_absolute():
                self.state_dir = Path(os.getcwd()) / state_path
            else:
                self.state_dir = state_path
        self._ensure_state_dir()

    def _ensure_state_dir(self):
        """Ensure state directory exists."""
        self.state_dir.mkdir(parents=True, exist_ok=True)

    def _state_file_path(self, bug_id: str) -> Path:
        """Get path to state file for bug ID."""
        safe_id = bug_id.replace("/", "_").replace("\\", "_")
        return self.state_dir / f"{safe_id}.json"

    def _backup_state(self, bug_id: str):
        """Create backup of existing state file."""
        state_path = self._state_file_path(bug_id)
        if state_path.exists():
            backup_dir = self.state_dir / "backups"
            backup_dir.mkdir(exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = backup_dir / f"{bug_id}_{timestamp}.json"
            shutil.copy2(state_path, backup_path)

    def _now(self) -> str:
        """Get current ISO timestamp."""
        return datetime.now().isoformat()

    def create(self, bug_id: str, initial_data: Optional[dict] = None) -> BugState:
        """Create a new bug state file."""
        state = BugState()
        state.bug_id = bug_id
        state.created_at = self._now()
        state.updated_at = state.created_at

        # Initialize nested structures
        state.metadata = {
            "reporter": "",
            "assignee": "",
            "labels": [],
            "affected_versions": [],
            "target_fix_version": "",
            "regression": False,
            "customer_impact": "",
            "affected_users": 0,
        }

        state.description = {
            "summary": "",
            "observed_behavior": "",
            "expected_behavior": "",
            "additional_context": "",
        }

        state.reproduction = {
            "steps": [],
            "reproduction_rate": "",
            "automated_reproduction": {
                "possible": False,
                "script_path": "",
                "last_attempt": "",
                "status": "not_attempted",
                "evidence": {
                    "screenshots": [],
                    "logs": []
                }
            }
        }

        state.error_analysis = {
            "error_type": "",
            "error_message": "",
            "stack_trace": [],
            "likely_cause": "",
        }

        state.investigation = {
            "status": "not_started",
            "started_at": "",
            "hypothesis": [],
            "root_cause": None,
            "notes": [],
        }

        state.fix = {
            "status": "pending",
            "description": "",
            "implementation": {
                "started_at": "",
                "completed_at": "",
                "files_changed": [],
                "commits": [],
                "pull_request": "",
            },
            "verification": {
                "status": "pending",
                "verified_at": "",
                "verified_by": "",
                "test_results": {
                    "original_bug": "not_tested",
                    "test_cases_passed": 0,
                    "test_cases_failed": 0,
                }
            }
        }

        state.regression_testing = {
            "status": "pending",
            "test_suites": [],
            "executed_at": "",
            "new_issues_found": [],
        }

        state.detective_state = {
            "current_phase": "new",
            "phases_completed": [],
            "blockers": [],
            "related_bugs": [],
        }

        state.resolution = {
            "resolution_type": "",
            "closed_at": "",
            "time_to_resolution_hours": 0,
            "lessons_learned": [],
        }

        # Apply initial data if provided
        if initial_data:
            self._merge_data(state, initial_data)

        # Save to file
        self.save(state)
        return state

    def _merge_data(self, state: BugState, data: dict):
        """Merge data into state object."""
        for key, value in data.items():
            if hasattr(state, key):
                current = getattr(state, key)
                if isinstance(current, dict) and isinstance(value, dict):
                    current.update(value)
                else:
                    setattr(state, key, value)

    def load(self, bug_id: str) -> Optional[BugState]:
        """Load bug state from file."""
        state_path = self._state_file_path(bug_id)
        if not state_path.exists():
            return None

        with open(state_path, 'r') as f:
            data = json.load(f)

        return BugState.from_dict(data)

    def save(self, state: BugState):
        """Save bug state to file."""
        state.updated_at = self._now()
        state_path = self._state_file_path(state.bug_id)

        with open(state_path, 'w') as f:
            json.dump(state.to_dict(), f, indent=2)

    def update(self, bug_id: str, updates: dict) -> Optional[BugState]:
        """Update specific fields in bug state."""
        state = self.load(bug_id)
        if state is None:
            return None

        self._backup_state(bug_id)
        self._merge_data(state, updates)
        self.save(state)
        return state

    def delete(self, bug_id: str) -> bool:
        """Delete bug state file."""
        state_path = self._state_file_path(bug_id)
        if state_path.exists():
            self._backup_state(bug_id)
            state_path.unlink()
            return True
        return False

    def exists(self, bug_id: str) -> bool:
        """Check if bug state exists."""
        return self._state_file_path(bug_id).exists()

    def list_bugs(self, status: Optional[str] = None, severity: Optional[str] = None) -> list:
        """List all bugs, optionally filtered by status or severity."""
        bugs = []
        for state_file in self.state_dir.glob("*.json"):
            with open(state_file, 'r') as f:
                data = json.load(f)

            if status and data.get("status") != status:
                continue
            if severity and data.get("severity") != severity:
                continue

            bugs.append(data)

        return bugs

    def list_by_severity(self) -> dict:
        """List bugs grouped by severity."""
        bugs = self.list_bugs()
        grouped = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": [],
            "trivial": [],
        }

        for bug in bugs:
            severity = bug.get("severity", "medium")
            if severity in grouped:
                grouped[severity].append(bug)
            else:
                grouped["medium"].append(bug)

        return grouped

    def add_note(self, bug_id: str, note: str, author: str = "") -> Optional[BugState]:
        """Add an investigation note."""
        state = self.load(bug_id)
        if state is None:
            return None

        self._backup_state(bug_id)

        note_entry = {
            "timestamp": self._now(),
            "author": author,
            "content": note,
        }

        if "notes" not in state.investigation:
            state.investigation["notes"] = []
        state.investigation["notes"].append(note_entry)

        self.save(state)
        return state

    def add_hypothesis(self, bug_id: str, description: str, status: str = "pending") -> Optional[BugState]:
        """Add a hypothesis to investigation."""
        state = self.load(bug_id)
        if state is None:
            return None

        self._backup_state(bug_id)

        # Generate hypothesis ID
        existing = state.investigation.get("hypothesis", [])
        hyp_id = f"HYP-{len(existing) + 1}"

        hypothesis = {
            "id": hyp_id,
            "description": description,
            "created_at": self._now(),
            "status": status,
            "evidence": [],
            "tested_by": "",
            "conclusion": "",
        }

        if "hypothesis" not in state.investigation:
            state.investigation["hypothesis"] = []
        state.investigation["hypothesis"].append(hypothesis)

        self.save(state)
        return state

    def set_root_cause(self, bug_id: str, cause: str, commit: str = "", file: str = "") -> Optional[BugState]:
        """Set the root cause for a bug."""
        state = self.load(bug_id)
        if state is None:
            return None

        self._backup_state(bug_id)

        state.investigation["root_cause"] = {
            "description": cause,
            "identified_at": self._now(),
            "responsible_commit": commit,
            "responsible_file": file,
        }

        state.investigation["status"] = "diagnosed"

        self.save(state)
        return state

    def update_status(self, bug_id: str, status: str) -> Optional[BugState]:
        """Update bug status."""
        if status not in BUG_STATUSES:
            raise ValueError(f"Invalid status: {status}. Must be one of: {BUG_STATUSES}")

        state = self.load(bug_id)
        if state is None:
            return None

        self._backup_state(bug_id)
        state.status = status
        self.save(state)
        return state

    def advance_phase(self, bug_id: str, new_phase: str) -> Optional[BugState]:
        """Advance to next detective phase."""
        if new_phase not in DETECTIVE_PHASES:
            raise ValueError(f"Invalid phase: {new_phase}. Must be one of: {DETECTIVE_PHASES}")

        state = self.load(bug_id)
        if state is None:
            return None

        self._backup_state(bug_id)

        current_phase = state.detective_state.get("current_phase", "new")

        # Add current phase to completed if not already
        completed = state.detective_state.get("phases_completed", [])
        if current_phase not in completed and current_phase != "new":
            completed.append(current_phase)

        state.detective_state["phases_completed"] = completed
        state.detective_state["current_phase"] = new_phase

        self.save(state)
        return state

    def get_next_bug(self) -> Optional[BugState]:
        """Get next bug to work on (highest severity, not closed)."""
        bugs_by_severity = self.list_by_severity()

        for severity in ["critical", "high", "medium", "low", "trivial"]:
            for bug_data in bugs_by_severity[severity]:
                if bug_data.get("status") not in ["closed", "wont_fix", "duplicate"]:
                    return BugState.from_dict(bug_data)

        return None

    def get_status_summary(self, bug_id: str) -> dict:
        """Get a summary of bug status for display."""
        state = self.load(bug_id)
        if state is None:
            return {"error": f"Bug {bug_id} not found"}

        return {
            "bug_id": state.bug_id,
            "title": state.title,
            "severity": state.severity,
            "status": state.status,
            "current_phase": state.detective_state.get("current_phase", "unknown"),
            "phases_completed": state.detective_state.get("phases_completed", []),
            "has_root_cause": state.investigation.get("root_cause") is not None,
            "hypothesis_count": len(state.investigation.get("hypothesis", [])),
            "notes_count": len(state.investigation.get("notes", [])),
        }


def get_state_manager(state_dir: Optional[str] = None) -> StateManager:
    """Get a state manager instance."""
    return StateManager(state_dir)


if __name__ == "__main__":
    import sys
    import argparse

    parser = argparse.ArgumentParser(description="Bug State Manager CLI")
    parser.add_argument("bug_id", nargs="?", help="Bug ID to operate on")
    parser.add_argument("--state-dir", default=DEFAULT_STATE_DIR, help="State directory")
    parser.add_argument("--list", action="store_true", help="List all bugs")
    parser.add_argument("--status", help="Filter by or set status")
    parser.add_argument("--severity", help="Filter by severity")
    parser.add_argument("--note", help="Add investigation note")
    parser.add_argument("--hypothesis", help="Add hypothesis")
    parser.add_argument("--root-cause", help="Set root cause")
    parser.add_argument("--phase", help="Advance to phase")
    parser.add_argument("--summary", action="store_true", help="Show status summary")

    args = parser.parse_args()

    manager = StateManager(args.state_dir)

    if args.list:
        bugs = manager.list_bugs(status=args.status, severity=args.severity)
        for bug in bugs:
            print(f"{bug['bug_id']}: {bug['title']} [{bug['severity']}] - {bug['status']}")
        sys.exit(0)

    if not args.bug_id:
        parser.print_help()
        sys.exit(1)

    if args.summary:
        summary = manager.get_status_summary(args.bug_id)
        print(json.dumps(summary, indent=2))
    elif args.note:
        manager.add_note(args.bug_id, args.note)
        print(f"Added note to {args.bug_id}")
    elif args.hypothesis:
        manager.add_hypothesis(args.bug_id, args.hypothesis)
        print(f"Added hypothesis to {args.bug_id}")
    elif args.root_cause:
        manager.set_root_cause(args.bug_id, args.root_cause)
        print(f"Set root cause for {args.bug_id}")
    elif args.phase:
        manager.advance_phase(args.bug_id, args.phase)
        print(f"Advanced {args.bug_id} to phase: {args.phase}")
    elif args.status:
        manager.update_status(args.bug_id, args.status)
        print(f"Updated {args.bug_id} status to: {args.status}")
    else:
        state = manager.load(args.bug_id)
        if state:
            print(json.dumps(state.to_dict(), indent=2))
        else:
            print(f"Bug {args.bug_id} not found")
            sys.exit(1)
