# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities through GitHub's private vulnerability
reporting: open the repository's Security tab and choose "Report a vulnerability"
(https://github.com/mariokreitz/verbatra/security/advisories/new). This keeps the
report private until a fix is available.

Do not open a public issue or pull request for a security vulnerability.

We aim to acknowledge a report within five business days, and we will keep you
informed as we investigate and work on a fix.

## Supported versions

verbatra is published to npm. Security fixes target the latest released minor;
upgrade to the latest release to receive them.

| Version | Supported |
| ------- | --------- |
| 0.2.x   | yes       |
| < 0.2.0 | no        |

## Handling of API keys

verbatra calls third-party translation providers, so the handling of provider
API keys is part of its security posture. Keys are read only from environment
variables: never from config files, never from command-line arguments, never
written to disk, and never logged. Errors are structured so that a key cannot be
embedded in an error message. This secret-free-by-construction design keeps a
provider key in the environment and prevents it from leaking through verbatra's
output.
