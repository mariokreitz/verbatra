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

verbatra has not had its first public release yet. Once the first version is
published to npm, security fixes will target the latest released version. Until
then, please report issues against the current `main` branch.

## Handling of API keys

verbatra calls third-party translation providers, so the handling of provider
API keys is part of its security posture. Keys are read only from environment
variables: never from config files, never from command-line arguments, never
written to disk, and never logged. Errors are structured so that a key cannot be
embedded in an error message. This secret-free-by-construction design keeps a
provider key in the environment and prevents it from leaking through verbatra's
output.
