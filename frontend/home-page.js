function HomePage() {
  return {
    // State
    view: 'businesses',
    selectedCategory: '',
    searchQuery: '',
    selectedBusiness: null,
    businessServices: [],
    totalWithTax: 0,

    // Mock data
    businesses: [
      { id: 1, name: 'صالون النخبة', category: 'barber', address: 'حي الملز', phone: '0500000001', distance: 1.2, rating: 4.6 },
      { id: 2, name: 'قصات راقية', category: 'barber', address: 'الصحافة', phone: '0500000002', distance: 0.9, rating: 4.8 },
      { id: 3, name: 'غسيل برو', category: 'carwash', address: 'العليا', phone: '0500000003', distance: 2.1, rating: 4.4 }
    ],

    services: [
      { id: 1, business_id: 1, name: 'قص شعر', duration_minutes: 30, price: 15 },
      { id: 2, business_id: 1, name: 'تحديد لحية', duration_minutes: 15, price: 10 },
      { id: 3, business_id: 2, name: 'تصفيف شعر', duration_minutes: 20, price: 10 },
      { id: 4, business_id: 3, name: 'غسيل خارجي', duration_minutes: 25, price: 30 },
    ],

    get filteredBusinesses() {
      return this.businesses.filter(b => {
        const matchesCat = this.selectedCategory ? b.category === this.selectedCategory : true;
        const matchesSearch = b.name.includes(this.searchQuery) || b.address.includes(this.searchQuery);
        return matchesCat && matchesSearch;
      });
    },

    filterBusinesses() {},

    showServices(business) {
      this.selectedBusiness = business;
      this.businessServices = this.services
        .filter(s => s.business_id === business.id)
        .map(s => ({ ...s, selected: false }));
      this.totalWithTax = 0;
      this.view = 'services';
    },

    updateTotal() {
      const subtotal = this.businessServices
        .filter(s => s.selected)
        .reduce((sum, s) => sum + s.price, 0);
      this.totalWithTax = subtotal.toFixed(2);
    },

    confirmSelection() {
      const selected = this.businessServices.filter(s => s.selected);
      if (selected.length === 0) {
        alert('يرجى اختيار خدمة واحدة على الأقل');
        return;
      }
      alert(`تم تأكيد ${selected.length} خدمة.\nالمجموع الكلي: ${this.totalWithTax} ريال`);
    }
  };
}
