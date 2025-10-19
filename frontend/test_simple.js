// Simple JavaScript test that should always pass
function testAddition() {
    if (1 + 1 !== 2) {
        throw new Error("Addition test failed");
    }
    console.log("✅ Addition test passed");
}

function testStringConcatenation() {
    const name = "Taboor";
    if (name + " CI" !== "Taboor CI") {
        throw new Error("String concatenation test failed");
    }
    console.log("✅ String concatenation test passed");
}

// Run the tests
try {
    testAddition();
    testStringConcatenation();
    console.log("🎉 All JavaScript tests passed!");
} catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1); // Exit with error code
}