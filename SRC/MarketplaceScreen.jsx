import React, { useState, useMemo } from 'react';
import { getCategoryDisplayName } from '../utils/category-helpers';

/**
 * Modern Mobile-First Products Marketplace Screen
 * 
 * Props accepted:
 * - products / items: Array of product objects from Firestore
 * - onSelectProduct: Callback function when a product is clicked (passes full product object to DetailScreen)
 * - onBack: Callback for navigating back
 * - categories: Array of category strings (optional)
 * - selectedDistance: Current distance filter
 * - onDistanceChange: Callback to update distance filter
 */
export default function MarketplaceScreen({
  products = [],
  items = [], // fallback if parent uses 'items'
  onSelectProduct,
  onNavigate,
  onBack,
  categories = ['All', 'Electronics', 'Fashion', 'Books', 'Home', 'Services', 'Vehicles', 'Other'],
  selectedDistance = 'all',
  onDistanceChange
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeDistance, setActiveDistance] = useState(selectedDistance || 'all');

  // Consolidate product source
  const rawProductsList = products.length > 0 ? products : items;

  // Handle distance change
  const handleDistanceSelect = (dist) => {
    setActiveDistance(dist);
    if (onDistanceChange) {
      onDistanceChange(dist);
    }
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return rawProductsList.filter((item) => {
      // 1. Search Query Filter
      const title = (item.title || item.name || item.productName || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || title.includes(query) || description.includes(query);

      // 2. Category Filter
      const itemCategory = item.category || 'Other';
      const matchesCategory =
        selectedCategory === 'All' ||
        itemCategory.toLowerCase() === selectedCategory.toLowerCase();

      // 3. Distance Filter (If distance value is numeric on item)
      let matchesDistance = true;
      if (activeDistance !== 'all' && typeof item.distance === 'number') {
        const maxDistMeters = parseInt(activeDistance, 10) * 1000;
        matchesDistance = item.distance <= maxDistMeters;
      }

      return matchesSearch && matchesCategory && matchesDistance;
    });
  }, [rawProductsList, searchQuery, selectedCategory, activeDistance]);

  // Handle click on product card -> routes to DetailScreen
  const handleCardClick = (product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else if (onNavigate) {
      onNavigate('detail', product);
    }
  };

  return (
    <div className="pm-screen-container">
      {/* Top Sticky Header */}
      <header className="pm-header">
        <div className="pm-header-top">
          {onBack && (
            <button
              type="button"
              className="pm-back-btn"
              onClick={onBack}
              aria-label="Go back"
            >
              â€¹
            </button>
          )}
          <h1 className="pm-title">Products Marketplace</h1>
        </div>

        {/* Professional Search Bar */}
        <div className="pm-search-box">
          <svg
            className="pm-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="pm-search-input"
            placeholder="Search products, items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="pm-search-clear"
              onClick={() => setSearchQuery('')}
            >
              âœ•
            </button>
          )}
        </div>

        {/* Horizontal Category Filter Pills */}
        <div className="pm-categories-scroll">
          {categories.map((cat) => {
            const catLabel = typeof cat === 'string' ? cat : cat.name || cat.label;
            const displayName = getCategoryDisplayName ? getCategoryDisplayName(catLabel) : catLabel;
            const isActive = selectedCategory.toLowerCase() === catLabel.toLowerCase();

            return (
              <button
                key={catLabel}
                type="button"
                className={`pm-category-pill ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(catLabel)}
              >
                {displayName}
              </button>
            );
          })}
        </div>

        {/* Distance / Location Filter Chips */}
        <div className="pm-distance-bar">
          {[
            { label: 'All Distance', val: 'all' },
            { label: 'Within 5 KM', val: '5' },
            { label: 'Within 10 KM', val: '10' },
            { label: 'Within 20 KM', val: '20' }
          ].map((d) => (
            <button
              key={d.val}
              type="button"
              className={`pm-distance-chip ${activeDistance === d.val ? 'active' : ''}`}
              onClick={() => handleDistanceSelect(d.val)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </header>

      {/* Product Content / Grid */}
      <main className="pm-content">
        {filteredProducts.length === 0 ? (
          <div className="pm-empty-state">
            <div className="pm-empty-icon">ðŸ“¦</div>
            <h3>No products found</h3>
            <p>Try tweaking your search term, category, or distance filter.</p>
          </div>
        ) : (
          <div className="pm-grid">
            {filteredProducts.map((item) => {
              // Safe field resolutions adhering to existing Firestore schema
              const title = item.title || item.name || item.productName || 'Untitled Item';
              const points = item.points ?? item.karmaPoints ?? item.price ?? 0;
              const imageUrl =
                item.imageUrl ||
                item.image ||
                item.photoUrl ||
                (Array.isArray(item.images) && item.images[0]) ||
                'https://via.placeholder.com/300?text=No+Image';

              const sellerName =
                item.sellerName ||
                item.userName ||
                item.postedBy ||
                item.sellerId ||
                'Seller';

              const distanceText =
                item.distanceFormatted ||
                (typeof item.distance === 'number' ? `${item.distance} m` : item.location || 'Local');

              return (
                <article
                  key={item.id || item._id || Math.random()}
                  className="pm-card"
                  onClick={() => handleCardClick(item)}
                >
                  <div className="pm-card-image-wrapper">
                    <img
                      src={imageUrl}
                      alt={title}
                      className="pm-card-image"
                      loading="lazy"
                    />
                  </div>

                  <div className="pm-card-body">
                    <h2 className="pm-card-title">{title}</h2>

                    <div className="pm-card-kp">
                      <span className="pm-kp-icon">âœ§</span>
                      <span className="pm-kp-amount">{points} KP</span>
                    </div>

                    <div className="pm-card-seller">
                      <span className="pm-seller-name">{sellerName}</span>
                      <span className="pm-seller-dot">â€¢</span>
                      <span className="pm-seller-distance">{distanceText}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
