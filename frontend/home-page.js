class Business {
  constructor({ id, name, category, address, phone, distance, rating, queuePeople, queuePosition, waitTime }) {
    Object.assign(this, { id, name, category, address, phone, distance, rating, queuePeople, queuePosition, waitTime });
  }
}

class Service {
  constructor({ id, business_id, name, duration_minutes, price }) {
    Object.assign(this, { id, business_id, name, duration_minutes, price });
    this.selected = false;
  }
}

function HomePage() {
  return {
    view: 'businesses',
    selectedCategory: '',
    searchQuery: '',
    selectedBusiness: null,
    businessServices: [],
    totalWithTax: '0.00',

    // ✅ Static businesses and wait times
    businesses: [
      new Business({
        id: 1,
        name: 'صالون النخبة',
        category: 'barber',
        address: 'حي الملز',
        phone: '0500000001',
        distance: 1.2,
        rating: 4.6,
        queuePeople: 4,
        queuePosition: 5,
        waitTime: 22
      }),
      new Business({
        id: 2,
        name: 'قصات راقية',
        category: 'barber',
        address: 'الصحافة',
        phone: '0500000002',
        distance: 0.9,
        rating: 4.8,
        queuePeople: 2,
        queuePosition: 3,
        waitTime: 18
      }),
      new Business({
        id: 3,
        name: 'غسيل برو',
        category: 'carwash',
        address: 'العليا',
        phone: '0500000003',
        distance: 2.1,
        rating: 4.4,
        queuePeople: 6,
        queuePosition: 7,
        waitTime: 28
      })
    ],

    // ✅ Services without “expected wait” per service
    servicesAll: [
      new Service({ id: 1, business_id: 1, name: 'قص شعر', duration_minutes: 30, price: 25 }),
      new Service({ id: 2, business_id: 1, name: 'تحديد لحية', duration_minutes: 15, price: 15 }),
      new Service({ id: 3, business_id: 2, name: 'تصفيف شعر', duration_minutes: 20, price: 18 }),
      new Service({ id: 4, business_id: 3, name: 'غسيل خارجي', duration_minutes: 25, price: 30 }),
      new Service({ id: 5, business_id: 3, name: 'غسيل شامل', duration_minutes: 40, price: 45 })
    ],

    get filteredBusinesses() {
      return this.businesses.filter(b => {
        const catOk = this.selectedCategory ? b.category === this.selectedCategory : true;
        const q = this.searchQuery.trim();
        const sOk = q ? (b.name.includes(q) || b.address.includes(q)) : true;
        return catOk && sOk;
      });
    },

    filterBusinesses() {},

    showServices(b) {
      this.selectedBusiness = b;
      this.businessServices = this.servicesAll
        .filter(s => s.business_id === b.id)
        .map(s => new Service({ ...s })); // reset selected state
      this.totalWithTax = '0.00';
      this.view = 'services';
    },

    updateTotals() {
      const picked = this.businessServices.filter(s => s.selected);
      const subtotal = picked.reduce((sum, s) => sum + s.price, 0);
      this.totalWithTax = subtotal.toFixed(2);
    },

    confirmSelection() {
      const picked = this.businessServices.filter(s => s.selected);
      if (picked.length === 0) {
        alert('يرجى اختيار خدمة واحدة على الأقل');
        return;
      }

      const payload = {
        business: {
          id: this.selectedBusiness.id,
          name: this.selectedBusiness.name,
          address: this.selectedBusiness.address
        },
        services: picked.map(p => ({ id: p.id, name: p.name, price: p.price })),
        totals: {
          totalWithTax: this.totalWithTax
        },
        queue: {
          position: this.selectedBusiness.queuePosition,
          totalPeople: this.selectedBusiness.queuePeople,
          estMinutes: this.selectedBusiness.waitTime // unified wait time
        }
      };

      localStorage.setItem('queueStatus', JSON.stringify(payload));
      window.location.href = 'QStatus.html';
    }
  };
}
