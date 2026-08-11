import React, { useState, useMemo } from 'react';
import { getCategoryDisplayName } from '../utils/category-helpers';

/**
 * Redesigned Products Marketplace Screen
 * 
 * Accepts:
 * - products / items: Array of Firestore product objects
 * - onSelectProduct: Callback function to open DetailScreen
 * - onNavigate: Alternative navigation handler
 * - onBack: Callback to navigate back
 * - categories: Array of category strings or objects (optional override)
 * - selectedDistance: Initial active distance filter
 * - onDistanceChange: Callback when distance filter changes
 */
export default function MarketplaceScreen({
  products = [],
  items = [],
  onSelectProduct,
  onNavigate,
  onBack,
  categories = [
    'All',
    'Electronics',
    'Furniture',
    'Fashion & Clothing',
    'Beauty & Personal Care',
    'Home & Kitchen',
    'Books & Media',
    'Mobile Phones',
    'Vehicles',
    'Services',
    'Other'
  ],
  selectedDistance = 'all',
  onDistanceChange
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeDistance, setActiveDistance] = useState(selectedDistance || 'all');

  // Unified product data source from props
  const rawProducts = useMemo(() => {
    return Array.isArray(products) && products.length > 0 ? products : items;
  }, [products, items]);

  // Handle distance filter selection
  const handleDistanceSelect = (dist) => {
    setActiveDistance(dist);
    if (onDistanceChange) {
      onDistanceChange(dist);
    }
  };

  // Filtered product pipeline
  const filteredProducts = useMemo(() => {
    return rawProducts.filter((item) => {
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

      // 3. Distance Filter
      let matchesDistance = true;
      if (activeDistance !== 'all' && typeof item.distance === 'number') {
        const maxMeters = parseInt(activeDistance, 10) * 1000;
        matchesDistance = item.distance <= maxMeters;
      }

      return matchesSearch && matchesCategory && matchesDistance;
    });
  }, [rawProducts, searchQuery, selectedCategory, activeDistance]);

  // Pass complete product object to DetailScreen handler
  const handleCardClick = (product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else if (onNavigate) {
      onNavigate('detail', product);
    }
  };

  return (
    <div className="pm-screen-container">
      {/* Header & Controls Sticky Top Bar */}
      <header className="pm-header">
        <div className="pm-header-top">
          {onBack && (
            <button
              type="button"
              className="pm-back-btn"
              onClick={onBack}
              aria-label="Go Back"
            >
              â€¹
            </button>
          )}
          <h1 className="pm-title">Products Marketplace</h1>
        </div>

        {/* Modern Search Input */}
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
              aria-label="Clear Search"
            >
              âœ•
            </button>
          )}
        </div>

        {/* Horizontal Category Scroll */}
        <div className="pm-categories-scroll">
          {categories.map((cat) => {
            const rawLabel = typeof cat === 'string' ? cat : cat.name || cat.label;
            const displayName = getCategoryDisplayName ? getCategoryDisplayName(rawLabel) : rawLabel;
            const isActive = selectedCategory.toLowerCase() === rawLabel.toLowerCase();

            return (
              <button
                key={rawLabel}
                type="button"
                className={`pm-category-pill ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(rawLabel)}
              >
                {displayName}
              </button>
            );
          })}
        </div>

        {/* Compact Distance Chips */}
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

      {/* Main Responsive Grid Section */}
      <main className="pm-content">
        {filteredProducts.length === 0 ? (
          <div className="pm-empty-state">
            <div className="pm-empty-icon">ðŸ“¦</div>
            <h3>No products found</h3>
            <p>Try adjusting your search query, category, or distance filter.</p>
          </div>
        ) : (
          <div className="pm-grid">
            {filteredProducts.map((item) => {
              // Existing field mappings from Firestore
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
