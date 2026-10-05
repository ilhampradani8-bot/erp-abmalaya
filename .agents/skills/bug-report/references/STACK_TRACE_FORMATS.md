# Stack Trace Formats Reference

This document describes the stack trace formats supported by the parser.

## Python

### Format
```
Traceback (most recent call last):
  File "path/to/file.py", line N, in function_name
    code_line_here
  File "path/to/other.py", line M, in other_function
    another_code_line
ErrorType: Error message here
```

### Example
```python
Traceback (most recent call last):
  File "/app/main.py", line 45, in process_request
    result = handler.handle(data)
  File "/app/handlers.py", line 123, in handle
    return self.validate(data)
  File "/app/validators.py", line 78, in validate
    raise ValueError("Invalid input format")
ValueError: Invalid input format
```

### Parsed Fields
- Error Type: `ValueError`
- Error Message: `Invalid input format`
- Stack Frames: File, line, function, code snippet
- Most recent call is LAST in Python traces

## JavaScript/Node.js

### Format
```
ErrorType: Error message
    at functionName (file.js:line:column)
    at otherFunction (other.js:line:column)
    at Object.<anonymous> (main.js:line:column)
```

### Example
```javascript
TypeError: Cannot read property 'submit' of null
    at handleLoginClick (login.js:45:12)
    at HTMLButtonElement.<anonymous> (login.js:38:5)
    at EventTarget.dispatchEvent (events.js:123:10)
```

### Parsed Fields
- Error Type: `TypeError`
- Error Message: `Cannot read property 'submit' of null`
- Stack Frames: Function, file, line, column
- Most recent call is FIRST in JavaScript traces

### Variations
```javascript
// Anonymous function
    at /path/to/file.js:10:5

// Async stack trace
    at async processRequest (handler.js:20:3)

// Native code
    at Array.forEach (<anonymous>)
```

## Java

### Format
```
Exception in thread "thread-name" package.ExceptionType: message
    at package.Class.method(File.java:line)
    at package.OtherClass.otherMethod(OtherFile.java:line)
Caused by: package.CauseException: cause message
    at package.CauseClass.causeMethod(CauseFile.java:line)
```

### Example
```java
Exception in thread "main" java.lang.NullPointerException: Cannot invoke method on null object
    at com.example.UserService.getUser(UserService.java:45)
    at com.example.AuthController.login(AuthController.java:123)
    at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
Caused by: java.sql.SQLException: Connection refused
    at com.mysql.jdbc.Driver.connect(Driver.java:247)
```

### Parsed Fields
- Error Type: `NullPointerException`
- Error Message: `Cannot invoke method on null object`
- Thread: `main`
- Stack Frames: Full class path, method, file, line
- Caused By: Chained exception

## C# / .NET

### Format
```
Unhandled Exception: Namespace.ExceptionType: message
   at Namespace.Class.Method() in File.cs:line N
   at Namespace.OtherClass.OtherMethod() in OtherFile.cs:line M
```

### Example
```csharp
Unhandled Exception: System.NullReferenceException: Object reference not set to an instance of an object.
   at MyApp.Services.UserService.GetUser(Int32 id) in C:\src\Services\UserService.cs:line 45
   at MyApp.Controllers.AuthController.Login(LoginRequest request) in C:\src\Controllers\AuthController.cs:line 123
   at lambda_method(Closure , Object , Object[] )
```

### Parsed Fields
- Error Type: `NullReferenceException`
- Error Message: `Object reference not set to an instance of an object.`
- Stack Frames: Namespace, class, method, parameters, file path, line

## Common Error Types

### Null/Undefined Access
| Language | Error Type |
|----------|-----------|
| Python | `AttributeError`, `TypeError` |
| JavaScript | `TypeError: Cannot read property 'x' of null/undefined` |
| Java | `NullPointerException` |
| C# | `NullReferenceException` |

### Index Out of Bounds
| Language | Error Type |
|----------|-----------|
| Python | `IndexError`, `KeyError` |
| JavaScript | Returns `undefined` (no error) |
| Java | `ArrayIndexOutOfBoundsException`, `IndexOutOfBoundsException` |
| C# | `IndexOutOfRangeException` |

### Type Mismatch
| Language | Error Type |
|----------|-----------|
| Python | `TypeError`, `ValueError` |
| JavaScript | `TypeError` |
| Java | `ClassCastException` |
| C# | `InvalidCastException` |

### File/IO Issues
| Language | Error Type |
|----------|-----------|
| Python | `FileNotFoundError`, `IOError`, `PermissionError` |
| JavaScript | `Error: ENOENT`, `Error: EACCES` |
| Java | `FileNotFoundException`, `IOException` |
| C# | `FileNotFoundException`, `IOException` |

## Detection Patterns

The parser uses these patterns to identify languages:

```python
# Python detection
r'Traceback \(most recent call last\):'
r'File ".+", line \d+, in'

# JavaScript detection
r'at .+\s+\(.+:\d+:\d+\)'
r'at\s+\S+\s+\(\S+\.js:\d+:\d+\)'

# Java detection
r'at\s+[\w.]+\([\w.]+\.java:\d+\)'
r'Exception in thread'

# C# detection
r'at .+ in .+:line \d+'
r'at \w+\.\w+\.\w+\('
```

## Parsing Tips

1. **Identify Language First** - Different languages have different trace formats
2. **Extract Error Type** - Usually at the beginning or end of trace
3. **Parse Frames** - Each `at` or `File` line is a frame
4. **Note Order** - Python: oldest first, others: newest first
5. **Handle Variations** - Anonymous functions, native methods, async traces
