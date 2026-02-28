# Modern Web Development Manifesto (2026)

## 🏗️ 1. Architecture: "Modular & Agentic-Ready"
* **API-First Design:** Build every service with the assumption that an AI Agent or a third-party service will consume it, not just a human via a browser.
* **Decoupled Logic:** Maintain a strict separation between the "Brain" (Business Logic/API), the "Memory" (Database), and the "Face" (UI).
* **Micro-services vs. Modular Monoliths:** Prefer a "Modular Monolith" approach initially to reduce complexity, but ensure boundaries are clean for future scaling.

## 🛡️ 2. Security: "Zero-Trust & Identity-First"
* **Zero-Trust Layer:** Never trust a request just because it's "logged in." Validate roles, permissions, and scopes at every single API boundary.
* **Passkey Integration:** Prioritize biometric and OAuth-based authentication. Treat traditional passwords as a legacy fallback.
* **Environment Integrity:** Use strict Zod validation for all environment variables to prevent runtime failures due to missing secrets.

## 💎 3. Data: "The Single Source of Truth"
* **Relational Backbone:** Always use a relational database (like PostgreSQL) for core data integrity. Offload specific tasks to specialized engines (Search to Typesense, Cache to Redis).
* **Strict Typing:** Maintain 100% TypeScript coverage. If a data shape isn't typed, it shouldn't exist in the codebase.
* **Runtime Safety:** Use **Zod** or **Valibot** to validate data as it crosses the "untrusted" boundary (API to Client, DB to Server).

## 🚀 4. Performance: "Predictive & Edge-First"
* **Interaction to Next Paint (INP):** Optimize for the user's perception of speed. Use optimistic UI updates and skeleton states.
* **Predictive Prefetching:** Use AI-assisted pre-loading to fetch data based on user behavior patterns.
* **Edge Functions:** Deploy heavy logic as close to the user as possible to maintain a global latency target of <50ms.

## 🤖 5. Workflow: "AI-Native Engineering"
* **Context Engineering:** When working with AI (like Claude Code), provide **Schemas** and **Architectural Plans** before asking for code.
* **Atomic Iteration:** Build in small, testable loops. Commit code after every successful feature block to maintain a clean history for AI rollback.
* **Self-Documenting Code:** Write code that is readable by both humans and LLMs. Prefer clarity over clever one-liners.

## 🌍 6. Ethics: "Inclusion & Sustainability"
* **Inclusion by Default:** Accessibility (A11y) is a core requirement. Use semantic HTML and ARIA standards so AI-driven screen readers can navigate perfectly.
* **Resource Efficiency:** Use Server Components (RSC) to reduce the compute load on the user's device, extending battery life and reducing energy consumption.
