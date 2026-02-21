/**
 * ✅ UNIT TEST DEMO: Testing formatUser in complete isolation
 *
 * Key characteristics of a unit test:
 * - Tests ONE function/unit of code
 * - No external dependencies (no Express, no HTTP, no database)
 * - Fast execution (<10ms per test)
 * - Mocks/stubs any external calls (none needed here!)
 * - Focuses on logic, not integration
 */

import { formatUser, APP_NAME } from "./index";
import type { User } from "./index";

// ─────────────────────────────────────────────────────────
// 🧪 Test Suite: formatUser Function (Pure Unit)
// ─────────────────────────────────────────────────────────
describe("formatUser (unit test)", () => {
  // ✅ Test 1: Basic functionality - happy path
  it("formats user with numeric ID", () => {
    // Arrange: Prepare test input
    const user: User = { id: 1, name: "Alice" };

    // Act: Call the function under test
    const result = formatUser(user);

    // Assert: Verify the output matches expectation
    expect(result).toBe("User: Alice (ID: 1)");
  });

  // ✅ Test 2: Edge case - string ID (type flexibility)
  it("formats user with string ID", () => {
    const user: User = { id: "abc-123", name: "Bob" };
    const result = formatUser(user);

    expect(result).toBe("User: Bob (ID: abc-123)");
  });

  // ✅ Test 3: Edge case - special characters in name
  it("handles names with special characters", () => {
    const user: User = { id: 2, name: "O'Brien Jr." };
    const result = formatUser(user);

    // The function should preserve special chars (no sanitization)
    expect(result).toBe("User: O'Brien Jr. (ID: 2)");
  });

  // ✅ Test 4: Edge case - empty name (if allowed by type)
  it("handles empty name gracefully", () => {
    const user: User = { id: 3, name: "" };
    const result = formatUser(user);

    expect(result).toBe("User:  (ID: 3)");
    // Note: You might want to add validation in real code!
  });
});

// ─────────────────────────────────────────────────────────
// 🧪 Test Suite: APP_NAME Constant (Trivial Unit)
// ─────────────────────────────────────────────────────────
describe("APP_NAME constant (unit test)", () => {
  it("exports the expected application name", () => {
    // Constants are trivial to test, but this documents the contract
    expect(APP_NAME).toBe("Lerna Mono Demo (React 19)");
  });

  it("is a non-empty string", () => {
    // Basic type/contract validation
    expect(typeof APP_NAME).toBe("string");
    expect(APP_NAME.length).toBeGreaterThan(0);
  });
});
