def test_failing_addition():
    """This test should FAIL - wrong expected result"""
    assert 1 + 1 == 3  # This is wrong!

def test_failing_string():
    """This test should FAIL - string mismatch"""
    name = "Taboor"
    assert name == "WrongName"  # This will fail