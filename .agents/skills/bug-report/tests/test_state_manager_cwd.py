#!/usr/bin/env python3
"""
Test script to verify that StateManager creates .bug-states in the current working directory
"""

import os
import sys
import tempfile
import shutil
from pathlib import Path

# Add the scripts directory to the path
SKILL_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(SKILL_DIR / "scripts"))

from state_manager import StateManager

def test_state_manager_creates_in_cwd():
    """Test that StateManager creates .bug-states in current working directory"""
    
    # Create a temporary directory to simulate a user project
    with tempfile.TemporaryDirectory() as temp_project:
        print(f"Testing in temporary project: {temp_project}")
        
        # Change to the temporary project directory
        original_cwd = os.getcwd()
        try:
            os.chdir(temp_project)
            print(f"Current working directory: {os.getcwd()}")
            
            # Create a state manager (should create .bug-states in temp_project)
            manager = StateManager()
            
            # Verify the state directory is in the current working directory
            expected_path = Path(temp_project) / ".bug-states"
            actual_path = manager.state_dir
            
            print(f"Expected path: {expected_path}")
            print(f"Actual path: {actual_path}")
            print(f"Paths match: {expected_path == actual_path}")
            
            # Verify the directory was actually created
            assert actual_path.exists(), f"Directory not created at {actual_path}"
            assert actual_path.is_dir(), f"{actual_path} is not a directory"
            
            # Create a test bug state to ensure it works
            state = manager.create("TEST-001", {
                "title": "Test Bug",
                "severity": "medium",
            })
            
            # Verify the state file was created in the correct location
            state_file = expected_path / "TEST-001.json"
            assert state_file.exists(), f"State file not created at {state_file}"
            
            print("\n✅ All tests passed!")
            print(f"✅ .bug-states created in current project directory: {expected_path}")
            print(f"✅ State file created successfully: {state_file}")
            
        finally:
            # Restore original working directory
            os.chdir(original_cwd)

if __name__ == "__main__":
    test_state_manager_creates_in_cwd()
