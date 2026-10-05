#!/usr/bin/env python3
"""
Stack Trace Parser

Parses and analyzes stack traces from multiple programming languages
including Python, JavaScript, Java, and C#.
"""

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class StackFrame:
    """Single frame in a stack trace."""
    frame_number: int = 0
    file: str = ""
    line: int = 0
    column: Optional[int] = None
    function: str = ""
    code_snippet: str = ""
    class_name: str = ""
    module: str = ""


@dataclass
class ErrorAnalysis:
    """Analyzed error information."""
    error_type: str = ""
    error_message: str = ""
    language: str = "unknown"
    stack_trace: list = field(default_factory=list)
    likely_point_of_failure: Optional[dict] = None
    common_causes: list = field(default_factory=list)
    raw_trace: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "error_type": self.error_type,
            "error_message": self.error_message,
            "language": self.language,
            "stack_trace": [
                {
                    "frame_number": f.frame_number,
                    "file": f.file,
                    "line": f.line,
                    "column": f.column,
                    "function": f.function,
                    "code_snippet": f.code_snippet,
                    "class_name": f.class_name,
                    "module": f.module,
                }
                for f in self.stack_trace
            ],
            "likely_point_of_failure": self.likely_point_of_failure,
            "common_causes": self.common_causes,
        }


class StackTraceParser:
    """Multi-language stack trace parser."""

    # Common error patterns and their likely causes
    ERROR_PATTERNS = {
        "NullPointerException": [
            "Attempting to use null object reference",
            "Object not initialized before use",
            "Return value from method is null",
        ],
        "TypeError": [
            "Incompatible types in operation",
            "Calling method on undefined/null",
            "Wrong argument type passed to function",
        ],
        "ReferenceError": [
            "Variable not defined in current scope",
            "Using variable before declaration",
            "Typo in variable or function name",
        ],
        "AttributeError": [
            "Accessing attribute that doesn't exist",
            "Object is None/null when attribute accessed",
            "Typo in attribute name",
        ],
        "KeyError": [
            "Dictionary key doesn't exist",
            "Missing expected key in data",
            "Case sensitivity issue in key name",
        ],
        "IndexError": [
            "Array/list index out of bounds",
            "Empty collection being accessed",
            "Off-by-one error in loop",
        ],
        "ValueError": [
            "Invalid value for operation",
            "Type conversion failed",
            "Invalid argument passed",
        ],
        "SyntaxError": [
            "Missing bracket, parenthesis, or quote",
            "Invalid syntax structure",
            "Incorrect indentation (Python)",
        ],
        "FileNotFoundError": [
            "File path is incorrect",
            "File was deleted or moved",
            "Permission issues",
        ],
        "ConnectionError": [
            "Network connectivity issue",
            "Server is down or unreachable",
            "Firewall blocking connection",
        ],
    }

    def detect_language(self, trace: str) -> str:
        """Detect the programming language from stack trace format."""
        # Python
        if "Traceback (most recent call last):" in trace:
            return "python"
        if re.search(r'File ".+", line \d+, in', trace):
            return "python"

        # JavaScript/Node.js
        if re.search(r'at .+\s+\(.+:\d+:\d+\)', trace):
            return "javascript"
        if re.search(r'at\s+\S+\s+\(\S+\.js:\d+:\d+\)', trace):
            return "javascript"

        # Java
        if re.search(r'at\s+[\w.]+\([\w.]+\.java:\d+\)', trace):
            return "java"
        if "Exception in thread" in trace:
            return "java"

        # C#
        if re.search(r'at .+ in .+:line \d+', trace):
            return "csharp"
        if re.search(r'at \w+\.\w+\.\w+\(', trace):
            return "csharp"

        return "unknown"

    def parse(self, trace: str, language: Optional[str] = None) -> ErrorAnalysis:
        """Parse a stack trace and extract error analysis."""
        if language is None:
            language = self.detect_language(trace)

        analysis = ErrorAnalysis()
        analysis.language = language
        analysis.raw_trace = trace

        if language == "python":
            self._parse_python(trace, analysis)
        elif language == "javascript":
            self._parse_javascript(trace, analysis)
        elif language == "java":
            self._parse_java(trace, analysis)
        elif language == "csharp":
            self._parse_csharp(trace, analysis)
        else:
            self._parse_generic(trace, analysis)

        # Identify likely point of failure
        if analysis.stack_trace:
            first_frame = analysis.stack_trace[0]
            analysis.likely_point_of_failure = {
                "file": first_frame.file,
                "line": first_frame.line,
                "function": first_frame.function,
                "reason": f"Error occurred in {first_frame.function or 'unknown function'}",
            }

        # Get common causes based on error type
        analysis.common_causes = self._get_common_causes(analysis.error_type)

        return analysis

    def _parse_python(self, trace: str, analysis: ErrorAnalysis):
        """Parse Python stack trace."""
        lines = trace.strip().split('\n')

        # Extract error type and message from last line
        for line in reversed(lines):
            error_match = re.match(r'^(\w+(?:Error|Exception|Warning)?):?\s*(.*)$', line)
            if error_match:
                analysis.error_type = error_match.group(1)
                analysis.error_message = error_match.group(2).strip()
                break

        # Parse stack frames
        frame_num = 0
        i = 0
        while i < len(lines):
            line = lines[i]

            # Match: File "path", line N, in function
            frame_match = re.match(r'\s*File "([^"]+)", line (\d+)(?:, in (.+))?', line)
            if frame_match:
                frame = StackFrame()
                frame.frame_number = frame_num
                frame.file = frame_match.group(1)
                frame.line = int(frame_match.group(2))
                frame.function = frame_match.group(3) or ""

                # Check for code snippet on next line
                if i + 1 < len(lines) and lines[i + 1].startswith('    '):
                    frame.code_snippet = lines[i + 1].strip()
                    i += 1

                analysis.stack_trace.append(frame)
                frame_num += 1

            i += 1

        # Reverse to get most recent call first
        analysis.stack_trace.reverse()

    def _parse_javascript(self, trace: str, analysis: ErrorAnalysis):
        """Parse JavaScript/Node.js stack trace."""
        lines = trace.strip().split('\n')

        # First line is usually the error
        if lines:
            error_match = re.match(r'^(\w+(?:Error)?):?\s*(.*)$', lines[0])
            if error_match:
                analysis.error_type = error_match.group(1)
                analysis.error_message = error_match.group(2).strip()

        # Parse stack frames
        frame_num = 0
        for line in lines[1:]:
            # Match: at functionName (file:line:column)
            frame_match = re.match(r'\s*at\s+(?:(\S+)\s+)?\(?([^:]+):(\d+):(\d+)\)?', line)
            if frame_match:
                frame = StackFrame()
                frame.frame_number = frame_num
                frame.function = frame_match.group(1) or "<anonymous>"
                frame.file = frame_match.group(2)
                frame.line = int(frame_match.group(3))
                frame.column = int(frame_match.group(4))

                analysis.stack_trace.append(frame)
                frame_num += 1

    def _parse_java(self, trace: str, analysis: ErrorAnalysis):
        """Parse Java stack trace."""
        lines = trace.strip().split('\n')

        # First line(s) contain the exception
        for line in lines:
            # Match: ExceptionType: message
            error_match = re.match(r'^(?:Exception in thread "[^"]+"\s+)?(\S+(?:Exception|Error)):?\s*(.*)$', line)
            if error_match:
                analysis.error_type = error_match.group(1).split('.')[-1]  # Get simple name
                analysis.error_message = error_match.group(2).strip()
                break

        # Parse stack frames
        frame_num = 0
        for line in lines:
            # Match: at package.Class.method(File.java:line)
            frame_match = re.match(r'\s*at\s+([\w.$]+)\(([\w.]+):(\d+)\)', line)
            if frame_match:
                frame = StackFrame()
                frame.frame_number = frame_num

                full_method = frame_match.group(1)
                parts = full_method.rsplit('.', 1)
                if len(parts) == 2:
                    frame.class_name = parts[0]
                    frame.function = parts[1]
                else:
                    frame.function = full_method

                frame.file = frame_match.group(2)
                frame.line = int(frame_match.group(3))

                analysis.stack_trace.append(frame)
                frame_num += 1

    def _parse_csharp(self, trace: str, analysis: ErrorAnalysis):
        """Parse C# stack trace."""
        lines = trace.strip().split('\n')

        # Extract exception info
        for line in lines:
            error_match = re.match(r'^(?:Unhandled Exception:\s+)?(\S+(?:Exception|Error)):?\s*(.*)$', line)
            if error_match:
                analysis.error_type = error_match.group(1).split('.')[-1]
                analysis.error_message = error_match.group(2).strip()
                break

        # Parse stack frames
        frame_num = 0
        for line in lines:
            # Match: at Namespace.Class.Method() in File.cs:line N
            frame_match = re.match(r'\s*at\s+([\w.]+)\((.*?)\)(?:\s+in\s+(.+):line\s+(\d+))?', line)
            if frame_match:
                frame = StackFrame()
                frame.frame_number = frame_num

                full_method = frame_match.group(1)
                parts = full_method.rsplit('.', 1)
                if len(parts) == 2:
                    frame.class_name = parts[0]
                    frame.function = parts[1]
                else:
                    frame.function = full_method

                if frame_match.group(3):
                    frame.file = frame_match.group(3)
                if frame_match.group(4):
                    frame.line = int(frame_match.group(4))

                analysis.stack_trace.append(frame)
                frame_num += 1

    def _parse_generic(self, trace: str, analysis: ErrorAnalysis):
        """Parse unknown format - extract what we can."""
        lines = trace.strip().split('\n')

        # Try to find error type and message
        for line in lines:
            error_match = re.match(r'^(\w*(?:Error|Exception)\w*):?\s*(.*)$', line)
            if error_match:
                analysis.error_type = error_match.group(1)
                analysis.error_message = error_match.group(2).strip()
                break

        # Try to extract file:line patterns
        frame_num = 0
        for line in lines:
            # Generic file:line pattern
            match = re.search(r'([^\s:]+):(\d+)', line)
            if match:
                frame = StackFrame()
                frame.frame_number = frame_num
                frame.file = match.group(1)
                frame.line = int(match.group(2))
                analysis.stack_trace.append(frame)
                frame_num += 1

    def _get_common_causes(self, error_type: str) -> list:
        """Get common causes for an error type."""
        # Check exact match
        if error_type in self.ERROR_PATTERNS:
            return self.ERROR_PATTERNS[error_type]

        # Check partial match
        for pattern, causes in self.ERROR_PATTERNS.items():
            if pattern.lower() in error_type.lower():
                return causes

        return ["Unknown error type - manual investigation required"]


def parse_stack_trace(trace: str, language: Optional[str] = None) -> ErrorAnalysis:
    """Convenience function to parse a stack trace."""
    parser = StackTraceParser()
    return parser.parse(trace, language)


if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: parse_stack_trace.py <trace-file> [--language python|javascript|java|csharp]")
        print("       Or pipe trace via stdin: echo 'trace' | parse_stack_trace.py -")
        sys.exit(1)

    language = None
    if "--language" in sys.argv:
        idx = sys.argv.index("--language")
        if idx + 1 < len(sys.argv):
            language = sys.argv[idx + 1]

    if sys.argv[1] == "-":
        trace = sys.stdin.read()
    else:
        with open(sys.argv[1], 'r') as f:
            trace = f.read()

    analysis = parse_stack_trace(trace, language)
    print(json.dumps(analysis.to_dict(), indent=2))
