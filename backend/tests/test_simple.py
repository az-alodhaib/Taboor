def test_addition():
    """Simple test that should always pass"""
    assert 1 + 1 == 2

def test_string_concatenation():
    """Test string operations"""
    name = "Taboor"
    assert name + " CI" == "Taboor CI"

def test_list_operations():
    """Test list operations"""
    numbers = [1, 2, 3]
    assert len(numbers) == 3
    assert numbers[0] == 1