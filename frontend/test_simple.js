// syntax error
// function brokenFunction(
//     console.log("This function has missing parenthesis"

function testAddition() {
    let result = 2 + 2;
    if (result !== 4) throw new Error("Addition failed");
    console.log("Addition test passed!");
}

function testSubtraction() {
    let result = 5 - 3;
    if (result !== 2) throw new Error("Subtraction failed");
    console.log("Subtraction test passed!");
}

// // faild unit test
// function testMultiplication() {
//     let result = 3 * 3;
//     if (result !== 10) throw new Error("Multiplication failed");
//     console.log("This won't print because test fails before here");
// }

