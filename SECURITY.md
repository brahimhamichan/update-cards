# Security Policy

## Report a vulnerability

Please email [Brahim](mailto:brahim@scalingadventures.com) with vulnerability reports. Do not open a public issue or include exploit details in a public pull request.

Include the affected version or commit, the impact you observed, and steps to reproduce it safely. Redact webhook URLs, tokens, personal data, and real user responses. We will review reports privately; no response-time commitment is made.

## Handling sensitive data

Webhook URLs can grant access to a callback endpoint. Keep them out of source control, logs, issues, and rendered examples. Callback payloads are untrusted user input and should be validated against the card configuration. The browser uses `no-cors`, so a submitted state does not prove that the endpoint accepted a response.
