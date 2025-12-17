// Leaflet map variables
let homeMap = null;
let homeMarkersLayer = null;

// ==========================
// Configurations
// ==========================

const API_BASE = "http://localhost:3000";

// Set tax rate here once; currently 15%
const TAX_RATE = 0.15;

// ==========================
// Location + ETA helpers (Frontend only)
// ==========================

// self-note: Show disclosure BEFORE triggering browser permission prompt.
async function requestLocationWithDisclosure() {
  const ok = confirm("📍 سنستخدم موقعك فقط لحساب وقت الوصول (ETA) للمزود. هل توافق؟");
  if (!ok) return null;
  return await getUserLocationOnce();
}

// self-note: Real browser geolocation prompt happens here.
function getUserLocationOnce() {
  if (!navigator.geolocation) throw new Error("Geolocation not supported");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

// self-note: Temporary distance-only ETA (no live traffic). Replace later with Google/HERE/TomTom routing.
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
             (Math.sin(dLng / 2) ** 2);
  const c = 2 * Math.atan2(Math.sqrt(s1 + s2), Math.sqrt(1 - (s1 + s2)));
  return R * c;
}

function approximateTravelMinutes(distanceKm) {
  const avgCitySpeedKmh = 35;
  return Math.max(1, Math.round((distanceKm / avgCitySpeedKmh) * 60));
}

// ==========================
// Data Models
// ==========================

class Business {
  constructor({ id, name, category, address, phone, latitude, longitude, distance, rating, queuePeople, queuePosition, waitTimeMinutes, travelMinutes }) {
    this.id = id;
    this.name = name;
    this.category = category || "";
    this.address = address || "";
    this.phone = phone || "";
    this.distance = distance || 0;
    this.rating = rating || 0;
    this.queuePeople = queuePeople || 0;
    this.queuePosition = queuePosition || 1;
    this.waitTimeMinutes = waitTimeMinutes || 0;
    this.latitude = latitude || null;
    this.longitude = longitude || null;
    this.travelMinutes = travelMinutes || 0;
  }
}

class Service {
  constructor({ id, business_id, name, duration_minutes, price }) {
    this.id = id;
    this.business_id = business_id;
    this.name = name;
    this.duration_minutes = duration_minutes || 0;
    this.price = price || 0;
    this.selected = false; // default: not selected
  }
}


// ==========================
// Alpine.js Component
// ==========================

function HomePage() {
  return {
    // State variables
    view: "businesses", // can be "businesses" or "services"
    selectedCategory: "",
    searchQuery: "",
    loading: false,
    errorMessage: "",
    businesses: [],              // list of Business objects
    selectedBusiness: null,      // currently chosen business
    businessServices: [],        // services for the selected business
    totalWithTax: "0.00",        // total price including tax
    userLocation: null,
    locationEnabled: false,

    // Initialization
   async init() {
  // self-note: ask user permission for location to compute ETA (travel time)
   try {
     const loc = await requestLocationWithDisclosure();
     if (loc) {
        this.userLocation = loc;
        this.locationEnabled = true;
     }
    } catch (e) {
       this.userLocation = null;
      this.locationEnabled = false;
   }

    await this.loadBusinesses();
    this.initMap();
    this.plotBusinessesOnMap();
    },


    // Load businesses from the backend
    async loadBusinesses() {
      this.loading = true;
      this.errorMessage = "";

      try {
        const response = await fetch(`${API_BASE}/businesses`);
        const json = await response.json();

        if (!response.ok) throw new Error(json.error || "فشل في تحميل المنشآت");

        // Convert each row to a Business object
      this.businesses = json.businesses.map((row, index) => {
      const hasCoords = row.latitude != null && row.longitude != null;
      const businessLoc = hasCoords ? { lat: Number(row.latitude), lng: Number(row.longitude) } : null;

      let distance = 1 + index * 0.5;
      let travelMinutes = 0;

      if (this.userLocation && businessLoc && !isNaN(businessLoc.lat) && !isNaN(businessLoc.lng)) {
      distance = haversineKm(this.userLocation, businessLoc);
      travelMinutes = approximateTravelMinutes(distance);
      }

      return new Business({
      ...row,
      latitude: row.latitude,
      longitude: row.longitude,
      distance,
      travelMinutes,
     rating: 4.5
      });
     });


      } catch (error) {
        console.error(error);
        this.errorMessage = error.message || "حدث خطأ غير متوقع";
      } finally {
        this.loading = false;
      }
    },

    // Filtered list of businesses based on category and search query
    get filteredBusinesses() {
      const query = this.searchQuery.trim();
      return this.businesses.filter(b => {
        const matchesCategory = this.selectedCategory ? b.category === this.selectedCategory : true;
        const matchesSearch = query ? b.name.includes(query) || (b.address || "").includes(query) : true;
        return matchesCategory && matchesSearch;
      });
    },

    // When a business card is clicked
    async showServices(business) {
      this.selectedBusiness = business;
      this.view = "services";
      this.totalWithTax = "0.00";
      this.businessServices = [];

      // Load services and queue info in parallel
      await Promise.all([
        this.loadServicesForBusiness(business.id),
        this.loadQueueInfoForBusiness(business)
      ]);

      this.updateTotals();
    },

    // Load services for a specific business
    async loadServicesForBusiness(businessId) {
      try {
        const response = await fetch(`${API_BASE}/businesses/${businessId}/services`);
        const json = await response.json();

        if (!response.ok) throw new Error(json.error || "فشل في تحميل الخدمات");

        // Convert to Service objects
        this.businessServices = json.services.map(row => new Service(row));
      } catch (error) {
        console.error(error);
        alert(error.message || "حدث خطأ أثناء تحميل الخدمات");
      }
    },

    // Load queue information for the selected business
    async loadQueueInfoForBusiness(business) {
      try {
        // Get queues for the business
        const queuesRes = await fetch(`${API_BASE}/businesses/${business.id}/queues`);
        const queuesJson = await queuesRes.json();
        if (!queuesRes.ok) throw new Error(queuesJson.error || "فشل في تحميل معلومات الطابور");

        const queues = queuesJson.queues || [];
        if (queues.length === 0) {
          // If no queues, reset queue data
          business.queuePeople = 0;
          business.queuePosition = 1;
          business.waitTimeMinutes = 0;
          return;
        }

        // Use the first open queue or the first available queue
        const activeQueue = queues.find(q => q.status === "open") || queues[0];

        // Get queue overview
        const overviewRes = await fetch(`${API_BASE}/queues/${activeQueue.id}/overview`);
        const overviewJson = await overviewRes.json();
        if (!overviewRes.ok) throw new Error(overviewJson.error || "فشل في قراءة ملخص الطابور");

        const stats = overviewJson.stats || {};
        const waitingCount = Number(stats.waiting || 0);
        const calledCount = Number(stats.called || 0);
        const peopleInLine = waitingCount + calledCount;

        // Update business queue info
        business.queuePeople = peopleInLine;
        business.queuePosition = peopleInLine + 1; // If joining now, they are last
        business.waitTimeMinutes = Number(overviewJson.estimated_wait_minutes || 0);
      } catch (error) {
        console.error(error);
        // On error, keep existing values or set defaults
        business.queuePeople = business.queuePeople || 0;
        business.queuePosition = business.queuePosition || 1;
        business.waitTimeMinutes = business.waitTimeMinutes || 0;
      }
    },

    // Update total cost including tax
    updateTotals() {
      const selectedServices = this.businessServices.filter(s => s.selected);
      const subtotal = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      const total = subtotal * (1 + TAX_RATE);
      this.totalWithTax = total.toFixed(2); // keep two decimal places
    },
    
    // Confirm selection and proceed
    confirmSelection() {
      if (!this.selectedBusiness) {
        alert("الرجاء اختيار مزود خدمة أولاً.");
        return;
      }

      const chosenServices = this.businessServices.filter(s => s.selected);
      if (chosenServices.length === 0) {
        alert("الرجاء اختيار خدمة واحدة على الأقل.");
        return;
      }

      const b = this.selectedBusiness;

      const payload = {
        business: {
          id: b.id,
          name: b.name,
          address: b.address,
          phone: b.phone
        },
        services: chosenServices.map(s => ({
          id: s.id,
          name: s.name,
          price: s.price,
          duration_minutes: s.duration_minutes
        })),
        totals: {
          taxRate: TAX_RATE,
          totalWithTax: this.totalWithTax
        },
        queue: {
        position: b.queuePosition,
        totalPeople: b.queuePeople,

        // self-note: submissionMinutes = MY selected service time (only for this user)
      submissionMinutes: chosenServices.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0),

      // self-note: waitMinutes = queue waiting time until my turn starts (from backend overview)
      waitMinutes: Number(b.waitTimeMinutes || 0),

      // self-note: travelMinutes = ETA from my current location -> business (approx for now)
      travelMinutes: Number(b.travelMinutes || 0),

      // self-note: estimationMinutes = waitMinutes + travelMinutes (new feature; will improve later with real traffic API)
      estimationMinutes: Number(b.waitTimeMinutes || 0) + Number(b.travelMinutes || 0),

      // self-note: legacy field kept so old QStatus still works
      estMinutes: Number(b.waitTimeMinutes || 0)
    }

      };
      
      // Save to localStorage so the QStatus page can read it
      localStorage.setItem("queueStatus", JSON.stringify(payload));
      window.location.href = "QStatus.html";
    },
    
    
    // ==========================
    // MAP: Initialize Leaflet Map
    // ==========================
    initMap() {
      const mapElement = document.getElementById("home-map");
      if (!mapElement) return;

      // Riyadh center
      const defaultCenter = [24.7136, 46.6753];

      homeMap = L.map("home-map").setView(defaultCenter, 10);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
       maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
      }).addTo(homeMap);

      // Layer for markers
     homeMarkersLayer = L.layerGroup().addTo(homeMap);
    },

    // ==========================
    // MAP: Add markers for all businesses
    // ==========================
    plotBusinessesOnMap() {
    if (!homeMap || !homeMarkersLayer) return;

      homeMarkersLayer.clearLayers();

      const bounds = L.latLngBounds();

      this.businesses.forEach((b) => {
    if (!b.latitude || !b.longitude) return;

        const lat = Number(b.latitude);
        const lng = Number(b.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

        const marker = L.marker([lat, lng]).addTo(homeMarkersLayer);

        const popup = `
          <strong>${b.name}</strong><br>
          <span style="font-size: 0.9rem;">${b.address || "بدون عنوان"}</span><br>
          <small style="color:#666;">${b.category || ""}</small>
        `;

      marker.bindPopup(popup);
      bounds.extend([lat, lng]);
    });

      if (!bounds.isEmpty()) {
       homeMap.fitBounds(bounds, { padding: [40, 40] });
      }
      }

  };
}
