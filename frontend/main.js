// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    
    // Get form elements
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');

    // Show register form
    showRegisterLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginForm.classList.add('d-none');
        registerForm.classList.remove('d-none');
    });

    // Show login form  
    showLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        registerForm.classList.add('d-none');
        loginForm.classList.remove('d-none');
    });
    
});
// =============================================
// Sample Data - Mock Service Providers
// =============================================
// This data will come from database later
const mockProviders = [
    {
        id: 1,
        name: 'صالون النخبة للحلاقة',
        category: 'barber',
        distance: 1.2,
        rating: 4.5,
        waitingTime: 15,
        address: 'حي الملز، الرياض'
    },
    {
        id: 2,
        name: 'قصات كلاسيكية',
        category: 'barber',
        distance: 0.8,
        rating: 4.6,
        waitingTime: 8,
        address: 'شارع العليا، الرياض'
    },
    {
        id: 3,
        name: 'ستوديو الأناقة الحديثة',
        category: 'barber',
        distance: 2.3,
        rating: 4.9,
        waitingTime: 22,
        address: 'حي النخيل، الرياض'
    },
    {
        id: 4,
        name: 'اختيار الجنتلمان',
        category: 'barber',
        distance: 1.7,
        rating: 4.5,
        waitingTime: 12,
        address: 'طريق الملك فهد، الرياض'
    }
];

// =============================================
// Global Variables
// =============================================
let currentProviders = [...mockProviders]; // Store current list
let selectedCategory = ''; // Store selected category
let searchQuery = ''; // Store search text

// =============================================
// Wait for page to load
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize the page
    initializePage();
    
    // Setup event listeners
    setupEventListeners();
});

// =============================================
// Function: Initialize Page
// Purpose: Load initial data and display providers
// =============================================
function initializePage() {
    // Display all providers initially
    displayProviders(mockProviders);
}

// =============================================
// Function: Setup Event Listeners
// Purpose: Connect user actions to functions
// =============================================
function setupEventListeners() {
    // Get DOM elements
    const categorySelect = document.getElementById('service-category');
    const searchInput = document.getElementById('search-input');
    
    // Listen for category changes
    if (categorySelect) {
        categorySelect.addEventListener('change', handleCategoryChange);
    }
    
    // Listen for search input
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
}

// =============================================
// Function: Handle Category Change
// Purpose: Filter providers by selected category
// Parameters: e = event object
// =============================================
function handleCategoryChange(e) {
    selectedCategory = e.target.value;
    
    // Filter providers based on category and search
    filterProviders();
}

// =============================================
// Function: Handle Search
// Purpose: Filter providers by search text
// Parameters: e = event object
// =============================================
function handleSearch(e) {
    searchQuery = e.target.value.toLowerCase();
    
    // Filter providers based on category and search
    filterProviders();
}

// =============================================
// Function: Filter Providers
// Purpose: Apply both category and search filters
// =============================================
function filterProviders() {
    let filtered = [...mockProviders];
    
    // Filter by category if selected
    if (selectedCategory) {
        filtered = filtered.filter(provider => 
            provider.category === selectedCategory
        );
    }
    
    // Filter by search query if not empty
    if (searchQuery) {
        filtered = filtered.filter(provider =>
            provider.name.toLowerCase().includes(searchQuery) ||
            provider.address.toLowerCase().includes(searchQuery)
        );
    }
    
    // Update current providers and display
    currentProviders = filtered;
    displayProviders(filtered);
}

// =============================================
// Function: Display Providers
// Purpose: Show list of service providers on page
// Parameters: providers = array of provider objects
// =============================================
function displayProviders(providers) {
    const container = document.getElementById('service-providers-list');
    
    // Clear existing content
    container.innerHTML = '';
    
    // Check if no providers found
    if (providers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-inbox display-1"></i>
                <p class="mt-3">لم يتم العثور على مقدمي خدمة</p>
            </div>
        `;
        return;
    }
    
    // Create card for each provider
    providers.forEach(provider => {
        const card = createProviderCard(provider);
        container.appendChild(card);
    });
}

// =============================================
// Function: Create Provider Card
// Purpose: Build HTML element for one provider
// Parameters: provider = single provider object
// Returns: HTML element (div)
// =============================================
function createProviderCard(provider) {
    // Create main card container
    const card = document.createElement('div');
    card.className = 'provider-card';
    
    // Determine waiting time class (short/medium/long)
    const waitingClass = getWaitingTimeClass(provider.waitingTime);
    
    // Build card HTML content
    card.innerHTML = `
        <div class="provider-header">
            <div>
                <h5 class="provider-name">${provider.name}</h5>
                <p class="text-muted mb-0">
                    <i class="bi bi-geo-alt"></i>
                    ${provider.address}
                </p>
            </div>
        </div>
        
        <div class="provider-info">
            <div class="info-item">
                <i class="bi bi-pin-map-fill text-primary"></i>
                <span>${provider.distance} كم</span>
            </div>
            <div class="info-item">
                <i class="bi bi-star-fill text-warning"></i>
                <span>${provider.rating}</span>
            </div>
        </div>
        
        <div class="d-flex justify-content-between align-items-center">
            <div class="waiting-time ${waitingClass}">
                <i class="bi bi-clock"></i>
                <span>وقت الانتظار: ${provider.waitingTime} دقيقة</span>
            </div>
            <button class="select-btn" onclick="selectProvider(${provider.id})">
                اختيار
            </button>
        </div>
    `;
    
    return card;
}

// =============================================
// Function: Get Waiting Time Class
// Purpose: Determine color based on waiting time
// Parameters: minutes = waiting time in minutes
// Returns: CSS class name (string)
// =============================================
function getWaitingTimeClass(minutes) {
    if (minutes <= 10) {
        return ''; // Green (default)
    } else if (minutes <= 20) {
        return 'medium'; // Orange
    } else {
        return 'long'; // Red
    }
}

// =============================================
// Function: Select Provider
// Purpose: Handle when user clicks "Select" button
// Parameters: providerId = ID of selected provider
// =============================================
function selectProvider(providerId) {
    // Find the selected provider
    const provider = mockProviders.find(p => p.id === providerId);
    
    if (!provider) {
        console.error('Provider not found');
        return;
    }
    
    // Show confirmation message
    console.log('Selected provider:', provider.name);
    
    // Store selection in localStorage
    localStorage.setItem('selectedProvider', JSON.stringify(provider));
    
    // Show alert (temporary - will be replaced with modal)
    alert(`تم اختيار: ${provider.name}\nوقت الانتظار المتوقع: ${provider.waitingTime} دقيقة`);
    
    // TODO: Navigate to queue confirmation page
    // window.location.href = 'queue-confirmation.html';
}

// =============================================
// Function: Load Providers from Database
// Purpose: Fetch real data from backend (for future use)
// =============================================
async function loadProvidersFromDatabase() {
    try {
        // Show loading state
        const container = document.getElementById('service-providers-list');
        container.innerHTML = `
            <div class="loading">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">جاري التحميل...</span>
                </div>
            </div>
        `;
        
        // TODO: Replace with actual API call
        // const response = await fetch('http://localhost:3000/providers');
        // const data = await response.json();
        // displayProviders(data.providers);
        
        // For now, use mock data after 1 second
        setTimeout(() => {
            displayProviders(mockProviders);
        }, 1000);
        
    } catch (error) {
        console.error('Error loading providers:', error);
        
        // Show error message
        const container = document.getElementById('service-providers-list');
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle display-1 text-danger"></i>
                <p class="mt-3">حدث خطأ في تحميل البيانات</p>
            </div>
        `;
    }
}
// =========================
// Notification System
// =========================
function showNotification(message, type = "success") {
    // Create notification container if not already there
    let notification = document.getElementById("notification");
    if (!notification) {
        notification = document.createElement("div");
        notification.id = "notification";
        notification.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3 d-none`;
        notification.setAttribute("role", "alert");
        notification.style.cssText = "z-index:2000; min-width:300px;";
        document.body.appendChild(notification);
    }

    // Update and show
    notification.textContent = message;
    notification.classList.remove("d-none");
    notification.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;

    // Hide after 4 seconds
    setTimeout(() => {
        notification.classList.add("d-none");
    }, 4000);
}

// =========================
// Example: simulate service ready
// =========================
document.addEventListener("DOMContentLoaded", () => {
    // This part is only for testing
    const btn = document.createElement("button");
    btn.textContent = "تجربة إشعار الخدمة جاهزة";
    btn.className = "btn btn-gradient position-fixed bottom-0 start-50 translate-middle-x mb-4";
    btn.onclick = () => showNotification("خدمتك جاهزة الآن ✅", "success");
    document.body.appendChild(btn);
});
