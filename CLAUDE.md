# verbatra

i18n translation automation tool. Open source, English is the project language for all
code, comments, and documentation.

## Roles

This project uses five role lenses for Cowork work. Each is a focused mandate with explicit
boundaries, invoked one at a time. Full definitions and the typical feature flow live in
[docs/roles/README.md](docs/roles/README.md).

- Product Owner (`docs/roles/product-owner.md`): owns what and why — specs, acceptance criteria, v1 scope. Does not implement.
- Developer (`docs/roles/developer.md`): implements against spec and architecture, with tests. Does not self-approve.
- Code Reviewer (`docs/roles/code-reviewer.md`): independent review for correctness, architecture conformance, and maintainability. Finds problems; does not rewrite.
- QA (`docs/roles/qa.md`): functional verification against acceptance criteria, including edge cases. Does not do security or style.
- Security (`docs/roles/security.md`): independent audit against the verbatra threat model. Does not confirm functionality.
