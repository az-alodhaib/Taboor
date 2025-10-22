# syntax error
# def broken_function(
#     print("This function has missing parenthesis"

# success unit test    
def test_addition():
    result = 2 + 2
    assert result == 4
    
def test_subtraction():
    result = 5 - 3
    assert result == 2

#faild unit test
# def test_multiplication():
#     result = 3 * 3
#     assert result == 10

# if __name__ == "__main__":
#     test_addition()
#     test_subtraction()
#     # test_multiplication()
#     print("All tests completed!")