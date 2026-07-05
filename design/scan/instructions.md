# Strix scan instructions

Focus on practical, exploitable security issues in this repository.

Primary areas:
- Authentication and authorization bypass
- IDOR and broken access control
- Injection issues, including SQL, command, template, and prompt injection
- SSRF and unsafe outbound requests
- Insecure file upload or path traversal
- Exposed secrets and unsafe configuration
- Dependency and supply-chain risks

Rules:
- Do not use destructive payloads.
- Prefer proof-of-concept validation that is safe for a test environment.
- Report the affected file, route, parameter, and reproduction steps when possible.
- Do not include API keys, passwords, or tokens in this file.
