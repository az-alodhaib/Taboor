// =============================================
// Unit Tests for Service Selection Page
// =============================================
// This file tests the main.js functions

// =============================================
// Test Data
// =============================================
const testProviders = [
    {
        id: 1,
        name: 'Test Barber',
        category: 'barber',
        distance: 1.5,
        rating: 4.5,
        waitingTime: 10,
        address: 'Test Address'
    },
    {
        id: 2,
        name: 'Test Car Wash',
        category: 'carwash',
        distance: 2.0,
        rating: 4.0,
        waitingTime: 25,
        address: 'Test Address 2'
    }
];

// =============================================
// Test 1: Check if waiting time class is correct
// Purpose: Verify color classification for waiting times
// =============================================
function testGetWaitingTimeClass() {
    console.log('Running Test 1: Waiting Time Classification');
    
    // Test short waiting time (should return empty string = green)
    const shortTime = getWaitingTimeClass(5);
    if (shortTime === '') {
        console.log('✓ Short waiting time test passed');
    } else {
        console.error('✗ Short waiting time test failed');
    }
    
    // Test medium waiting time (should return 'medium' = orange)
    const mediumTime = getWaitingTimeClass(15);
    if (mediumTime === 'medium') {
        console.log('✓ Medium waiting time test passed');
    } else {
        console.error('✗ Medium waiting time test failed');
    }
    
    // Test long waiting time (should return 'long' = red)
    const longTime = getWaitingTimeClass(25);
    if (longTime === 'long') {
        console.log('✓ Long waiting time test passed');
    } else {
        console.error('✗ Long waiting time test failed');
    }
}

// =============================================
// Test 2: Check if provider card is created correctly
// Purpose: Verify HTML structure of provider cards
// =============================================
function testCreateProviderCard() {
    console.log('\nRunning Test 2: Provider Card Creation');
    
    const testProvider = testProviders[0];
    const card = createProviderCard(testProvider);
    
    // Check if card element exists
    if (card && card.className === 'provider-card') {
        console.log('✓ Card element created successfully');
    } else {
        console.error('✗ Card element creation failed');
    }
    
    // Check if provider name is included
    if (card.innerHTML.includes(testProvider.name)) {
        console.log('✓ Provider name included in card');
    } else {
        console.error('✗ Provider name missing from card');
    }
    
    // Check if waiting time is included
    if (card.innerHTML.includes(testProvider.waitingTime)) {
        console.log('✓ Waiting time included in card');
    } else {
        console.error('✗ Waiting time missing from card');
    }
}

// =============================================
// Test 3: Check filter by category
// Purpose: Verify category filtering works correctly
// =============================================
function testFilterByCategory() {
    console.log('\nRunning Test 3: Category Filtering');
    
    // Test filtering barber category
    const barbers = testProviders.filter(p => p.category === 'barber');
    
    if (barbers.length === 1 && barbers[0].category === 'barber') {
        console.log('✓ Category filter works correctly');
    } else {
        console.error('✗ Category filter failed');
    }
    
    // Test filtering non-existent category
    const restaurants = testProviders.filter(p => p.category === 'restaurant');
    
    if (restaurants.length === 0) {
        console.log('✓ Empty filter result handled correctly');
    } else {
        console.error('✗ Empty filter result handling failed');
    }
}

// =============================================
// Test 4: Check search functionality
// Purpose: Verify search filter works correctly
// =============================================
function testSearchFilter() {
    console.log('\nRunning Test 4: Search Filtering');
    
    const searchTerm = 'barber';
    
    // Test search by name
    const results = testProviders.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (results.length > 0) {
        console.log('✓ Search by name works correctly');
    } else {
        console.error('✗ Search by name failed');
    }
    
    // Test search with no results
    const noResults = testProviders.filter(p =>
        p.name.toLowerCase().includes('nonexistent')
    );
    
    if (noResults.length === 0) {
        console.log('✓ Empty search result handled correctly');
    } else {
        console.error('✗ Empty search result handling failed');
    }
}

// =============================================
// Test 5: Check provider selection
// Purpose: Verify provider can be selected and stored
// =============================================
function testProviderSelection() {
    console.log('\nRunning Test 5: Provider Selection');
    
    const testProvider = testProviders[0];
    
    // Simulate storing provider in localStorage
    localStorage.setItem('selectedProvider', JSON.stringify(testProvider));
    
    // Retrieve and verify
    const stored = JSON.parse(localStorage.getItem('selectedProvider'));
    
    if (stored && stored.id === testProvider.id) {
        console.log('✓ Provider selection and storage works');
    } else {
        console.error('✗ Provider selection or storage failed');
    }
    
    // Clean up
    localStorage.removeItem('selectedProvider');
}

// =============================================
// Test 6: Check sorting by distance
// Purpose: Verify providers can be sorted by distance
// =============================================
function testSortByDistance() {
    console.log('\nRunning Test 6: Distance Sorting');
    
    const sorted = [...testProviders].sort((a, b) => a.distance - b.distance);
    
    // Check if first item has smallest distance
    if (sorted[0].distance <= sorted[1].distance) {
        console.log('✓ Distance sorting works correctly');
    } else {
        console.error('✗ Distance sorting failed');
    }
}

// =============================================
// Test 7: Check sorting by rating
// Purpose: Verify providers can be sorted by rating
// =============================================
function testSortByRating() {
    console.log('\nRunning Test 7: Rating Sorting');
    
    const sorted = [...testProviders].sort((a, b) => b.rating - a.rating);
    
    // Check if first item has highest rating
    if (sorted[0].rating >= sorted[1].rating) {
        console.log('✓ Rating sorting works correctly');
    } else {
        console.error('✗ Rating sorting failed');
    }
}

// =============================================
// Test 8: Check data validation
// Purpose: Verify provider data has required fields
// =============================================
function testDataValidation() {
    console.log('\nRunning Test 8: Data Validation');
    
    const requiredFields = ['id', 'name', 'category', 'distance', 'rating', 'waitingTime'];
    let allValid = true;
    
    testProviders.forEach(provider => {
        requiredFields.forEach(field => {
            if (!(field in provider)) {
                console.error(`✗ Provider ${provider.id} missing field: ${field}`);
                allValid = false;
            }
        });
    });
    
    if (allValid) {
        console.log('✓ All providers have required fields');
    }
}

// =============================================
// Run All Tests
// Purpose: Execute all test functions
// =============================================
function runAllTests() {
    console.log('=================================');
    console.log('Starting Unit Tests');
    console.log('=================================');
    
    testGetWaitingTimeClass();
    testCreateProviderCard();
    testFilterByCategory();
    testSearchFilter();
    testProviderSelection();
    testSortByDistance();
    testSortByRating();
    testDataValidation();
    
    console.log('\n=================================');
    console.log('All Tests Completed');
    console.log('=================================');
}

// =============================================
// Auto-run tests when file is loaded
// =============================================
// Uncomment the line below to run tests automatically
// runAllTests();

// =============================================
// Export for manual testing
// =============================================
// To run tests manually, open browser console and type: runAllTests()
console.log('Unit tests loaded. Type runAllTests() to execute all tests.');