---
description: Guidelines for writing clean, maintainable, and human-readable code. Apply these rules when writing or reviewing code to ensure consistency and quality.
---

## Core Principles

- **KISS**: Keep code simple, avoid over-engineering
- **YAGNI**: Don’t add features until they are needed
- **DRY**: Eliminate duplication via abstraction or reuse
- **Small Functions**: Each function should do one thing well
- **No Side Effects**: Prefer pure functions; isolate effects at the edges

## Naming & Structure

- Use **meaningful, self-explanatory names**
- Group related code logically; use barrel exports for modules
- Keep types/interfaces close to where they’re used; extract only when shared
- Constants should replace all magic numbers and strings

## Comments & Documentation

- Document **public APIs and complex logic only**
  -Use comments to explain **why**, not **what**
- For tricky/effects-heavy code, describe gotchas and assumptions
- Use TypeDoc (`/** ... */`) format

## TypeScript Practices

- Enable **strict mode** in `tsconfig.json`
- Avoid `any`; prefer `unknown` with type guards
- Use `interface` for objects, `type` for unions/intersections
- Always type public function signatures explicitly
- Prefer readonly types for immutability
- Use discriminated unions for safer branching
- Avoid type assertions except at clear boundaries (e.g., parsing JSON)

## Error Handling

- **Never throw** — instead:
  - Use `Either` / `Option` / `Result` types from effect libraries
  - Represent expected failures in the type system
- Always handle errors at the boundary of the system (e.g., API layer)
- Include contextual information in error values (not stack traces)

## Effect-TS / Functional Code

- Model side effects with **typed effects**, not untyped Promises
- Prefer composition over nesting (`pipe`, `flatMap`, `mapError`)
- Use `Layer` for dependency injection
- Always annotate effect return types for clarity
- Avoid calling `unsafeRun*` in core logic; restrict it to the application entrypoint

## Testing

- Write tests for **public APIs** and **critical logic**
- Include edge cases, failure cases, and effectful code
- Keep test code clean and readable; use descriptive test names

## Code Quality Process

### Version Control

- Small, focused commits
- Clear commit messages (imperative mood: "Add...", "Fix...", "Remove...")
- Branch names should reflect feature or fix (`feature/mcp-traversal-api`)

### Maintenance

- Refactor when adding features to keep code clean
- Remove dead code immediately
- Leave code cleaner than you found it
- Review PRs for **readability, correctness, and maintainability**

## Documentation Rules

### Scope

- Document **only public APIs** and **complex or tricky internals**
- Skip trivial helpers, obvious code, or boilerplate

### Style

- Use concise TypeDoc comments
- Explain **inputs, outputs, side effects**
- Highlight **gotchas, edge cases, and implicit assumptions**
- Provide examples only when code is non-trivial

### Prohibited

- Don’t include AI-specific notes
- Don’t reference history or past refactors
- Don’t document simple/private code
