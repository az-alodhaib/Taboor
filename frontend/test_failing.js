// Simple failing JavaScript test
function testFailingAddition() {
    if (2 + 2 !== 5) {  // This is wrong!
        throw new Error("Failing test: 2+2 should equal 5 (this is wrong on purpose)");
    }
}

// This will throw an error and fail the test
testFailingAddition();