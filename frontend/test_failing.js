// JavaScript test that should FAIL
function testFailingAddition() {
    if (2 + 2 !== 5) {  // This is wrong!
        throw new Error("Failing addition test failed (as expected)");
    }
}

// Run the failing test
try {
    testFailingAddition();
    console.log("❌ This should not print - test should have failed");
} catch (error) {
    console.log("✅ Failing test correctly failed:", error.message);
    // Don't exit with error code for this demonstration
}