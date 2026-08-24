# Contributing

## Branch Naming

All branches must follow the pattern `feature/gt-<issue-number>`.

```
feature/gt-42
feature/gt-107
```

Branches must be created from the `main` branch.

## Commit Message Format

```
<type>: <imperative description>
```

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, `perf`, `ci`

Examples:
```
feat: add user authentication middleware
fix: handle null pointer in payment handler
chore: update dependencies
```

- Use the imperative mood ("add" not "added" / "adds")
- Capitalise the first word
- No trailing period
- The issue number is already in the branch name — no need to repeat it in the commit

## PR Description Template

Every pull request description must include:

```markdown
Closes #<issue-number>

## Summary
<!-- 1-3 sentences describing what this PR does -->

## Testing
<!-- How was this tested? -->

## Breaking Changes
<!-- List any breaking changes, or "None" -->
```

The `Closes #<N>` line is required — it auto-links and closes the issue on merge.

## Code Review Expectations

Reviewers must check for:

- **Correctness** — does the code do what it claims?
- **Edge cases** — invalid inputs, empty states, concurrency
- **Security** — injection, auth bypasses, secret exposure
- **Error handling** — all error paths handled gracefully
- **Test coverage** — new code should have tests
- **Style** — matches existing code conventions (linting)

## PR Lifecycle Workflow

1. An issue is created (optionally labeled `plan`).
2. If the `plan` label is applied and the issue is assigned to `Teammate`, the **plan** agent analyzes the issue and posts a plan comment. It creates sub-issues only for a breakdown already proposed and agreed in the discussion.
3. An issue is assigned to `Teammate`.
4. The **implement** agent creates a branch `feature/gt-<N>` from `main`.
5. The **implement** agent implements the feature and pushes commits.
6. The **implement** agent creates a PR with `Closes #<N>` in the body.
7. A reviewer is assigned (or review is requested from `Teammate`).
8. The **review** agent reviews the PR and posts feedback.
9. If changes are requested, the reviewer reassigns to `Teammate`.
10. The **pr-modify** agent addresses feedback, pushes changes, and reassigns back.
11. When approved, the PR is merged into `main`.
