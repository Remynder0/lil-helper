---
name: codebase-design
description: "Shared architectural vocabulary (module, interface, implementation, depth, seam, adapter, leverage, locality) and principles (The Deletion Test, testing at seams, design-it-twice) for designing deep, maintainable modules."
---

# Codebase Design

This skill defines the shared architectural vocabulary and design principles used to design, evaluate, and refactor deep modules.

## 1. The Strict 8-Term Vocabulary

Use these eight terms with their exact meanings, and avoid vague substitutes like "component", "service", "API", "layer", or "boundary":

1. **Module**: Anything with an interface and an implementation (scale-agnostic: a function, class, file, package, or vertical slice).
2. **Interface**: Everything a caller must know to use the module correctly: type shapes, invariants, ordering constraints, error modes, configuration, and performance characteristics.
3. **Implementation**: The logic and state hidden behind the interface.
4. **Depth**: A property of the interface relative to the implementation. A **deep** module hides substantial complexity behind a small, simple interface. A **shallow** module has an interface nearly as complex as its implementation.
5. **Seam**: A place where you can alter behavior or substitute an implementation without editing the caller.
6. **Adapter**: A concrete implementation that plugs into a seam (or translates between interfaces). *Rule of thumb: one adapter = hypothetical seam; two adapters (e.g. production + test/fallback) = real seam.*
7. **Leverage**: The net capability and reduction in cognitive load gained by callers using a module versus writing the logic themselves.
8. **Locality**: Keeping related logic and invariants together so understanding or changing one behavior does not require jumping across many files.

## 2. The Deletion Test

To evaluate whether a module or abstraction earns its keep, ask:

> *"If I deleted this module and inlined its implementation at every call site, where does the complexity go?"*

- **It vanishes** → The module is **shallow** (a pass-through or premature wrapper). Delete it and inline, or consolidate it into a deeper module.
- **It reappears across $N$ call sites** → The module is **deep**. It earns its keep by absorbing complexity behind a simpler interface.

## 3. Core Design Principles

- **The interface is the test surface**: Tests should exercise the exact interface callers use, never internal collaborators or private helpers.
- **Accept dependencies, return values**: Prefer pure data transformations and explicit dependency parameters at system boundaries so seams are trivial to test.
- **Design it twice**: When designing an important module interface, sketch at least two radically different interfaces (e.g. via parallel sub-agents) and compare their depth, locality, and ergonomics before committing.
