import React, { useState, useMemo } from 'react';
import { getCategoryDisplayName } from '../utils/category-helpers';

/**
 * Redesigned Mobile Products Marketplace Screen
 * Matches exact UI/UX reference structure while using Point Market data/theme.
 */
export default function MarketplaceScreen({
  products = [],
  items = [],
  onSelectProduct,
  onNavigate,
  onBack,
  categories = [
    'All',
    'Furniture',
    'Electronics',
    'Fashion & Clothing',
    'Beauty & Personal Care',
    'Home & Kitchen',
    'Books & Media',
    'Mobile Phones',
    'Services',
    'Other'
  ],
  selectedDistance = 'all',
  onDistanceChange,
  currentCity = 'Lahore',
  onNotificationClick,
  onFilterClick,
  onLocationClick
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeDistance, setActiveDistance] = useState(selectedDistance || 'all');

  const rawProducts = useMemo(() => {
    return Array.isArray(products) && products.length > 0 ? products : items;
  }, [products, items]);

  const handleDistanceSelect = (dist) => {
    const nextDist = activeDistance === dist ? 'all' : dist;
    setActiveDistance(nextDist);
    if (onDistanceChange) {
      onDistanceChange(nextDist);
    }
  };

  const filteredProducts = useMemo(() => {
    return rawProducts.filter((item) => {
      const title = (item.title || item.name || item.productName || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || title.includes(query) || description.includes(query);

      const itemCategory = item.category || 'Other';
      const matchesCategory =
        selectedCategory === 'All' ||
        selectedCategory === 'For You' ||
        itemCategory.toLowerCase() === selectedCategory.toLowerCase();

      let matchesDistance = true;
      if (activeDistance !== 'all' && typeof item.distance === 'number') {
        const maxMeters = parseInt(activeDistance, 10) * 1000;
        matchesDistance = item.distance <= maxMeters;
      }

      return matchesSearch && matchesCategory && matchesDistance;
    });
  }, [rawProducts, searchQuery, selectedCategory, activeDistance]);

  const handleCardClick = (product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else if (onNavigate) {
      onNavigate('detail', product);
    }
  };

  return (
    <div className="pm-marketplace-page">
      {/* 1. TOP HEADER */}
      <header className="pm-top-header">
        <div className="pm-header-left">
          {onBack && (
            <button
              type="button"
              className="pm-icon-btn pm-back-btn"
              onClick={onBack}
              aria-label="Go Back"
            >
              ‹
            </button>
          )}
          <div className="pm-header-titles">
            <h1 className="pm-header-title">Products Marketplace</h1>
            <p className="pm-header-subtitle">
              Buy, sell & trade with <span className="pm-highlight-text">Karma Points</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          className="pm-icon-btn pm-notif-btn"
          onClick={onNotificationClick}
          aria-label="Notifications"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
      </header>

      {/* 2. SEARCH BAR */}
      <div className="pm-search-section">
        <div className="pm-search-bar">
          <svg className="pm-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            type="text"
            className="pm-search-input"
            placeholder="Search products, traders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {searchQuery ? (
            <button
              type="button"
              className="pm-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear Search"
            >
              ✕
            </button>
          ) : (
            <button
              type="button"
              className="pm-filter-btn"
              onClick={onFilterClick}
              aria-label="Filter Options"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="7" y1="12" x2="17" y2="12" />
                <line x1="10" y1="18" x2="14" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 3. LOCATION BAR */}
      <div className="pm-location-section">
        <button type="button" className="pm-location-pill" onClick={onLocationClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{currentCity}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <button type="button" className="pm-gps-btn" onClick={onLocationClick} aria-label="Current Location">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      </div>

      {/* 4. DISTANCE FILTER */}
      <div className="pm-distance-section">
        {[
          { label: 'Within 5 KM', val: '5' },
          { label: 'Within 10 KM', val: '10' },
          { label: 'Within 20 KM', val: '20' }
        ].map((d) => (
          <button
            key={d.val}
            type="button"
            className={`pm-distance-pill ${activeDistance === d.val ? 'active' : ''}`}
            onClick={() => handleDistanceSelect(d.val)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* 5. PRODUCT CATEGORIES HORIZONTAL DISCOVERY */}
      {Array.isArray(categories) && categories.length > 0 && (
        <div className="pm-categories-scroll">
          {categories.map((cat) => {
            const rawLabel = typeof cat === 'string' ? cat : cat.name || cat.label;
            const displayName = getCategoryDisplayName ? getCategoryDisplayName(rawLabel) : rawLabel;
            const isActive = selectedCategory.toLowerCase() === rawLabel.toLowerCase();

            return (
              <button
                key={rawLabel}
                type="button"
                className={`pm-category-chip ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(rawLabel)}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      )}

      {/* 6. PRODUCT SECTION HEADER */}
      <div className="pm-section-header">
        <div className="pm-section-title">
          <span className="pm-section-star">★</span>
          <h2>Featured Listings</h2>
        </div>
        <button type="button" className="pm-see-all-btn">
          See all ›
        </button>
      </div>

      {/* 7-9. PRODUCT CARDS 2-COLUMN GRID */}
      <main className="pm-main-grid-container">
        {filteredProducts.length === 0 ? (
          <div className="pm-empty-state">
            <div className="pm-empty-icon">📦</div>
            <h3>No products found</h3>
            <p>Try tweaking your search term, category, or distance filter.</p>
          </div>
        ) : (
          <div className="pm-product-grid">
            {filteredProducts.map((item) => {
              const title = item.title || item.name || item.productName || 'Untitled Item';
              const points = item.points ?? item.karmaPoints ?? item.price ?? item.kp ?? 0;
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
                '';

              const distanceText =
                item.distanceFormatted ||
                (typeof item.distance === 'number' ? `${item.distance} m` : item.location || '0 m');

              const isVerified = item.isVerified || item.verified;
              const condition = item.condition;
              const rating = item.rating;

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
                    
                    {/* Karma Points Overlay Badge */}
                    <div className="pm-kp-badge">
                      {points} KP
                    </div>

                    {/* Wishlist / Save Heart Button */}
                    <button
                      type="button"
                      className="pm-card-heart-btn"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Save Item"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>

                  <div className="pm-card-body">
                    <div className="pm-card-title-row">
                      <h3 className="pm-card-title">{title}</h3>
                      {isVerified && (
                        <span className="pm-verified-icon" title="Verified Seller">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#1d4ed8">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                          </svg>
                        </span>
                      )}
                    </div>

                    <div className="pm-card-seller">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>
                        {sellerName ? `${sellerName} • ` : ''}{distanceText}
                      </span>
                    </div>

                    {(condition || rating) && (
                      <div className="pm-card-footer-tags">
                        {condition && (
                          <span className="pm-condition-tag">{condition}</span>
                        )}
                        {rating && (
                          <span className="pm-rating-tag">
                            {rating} <span className="pm-star">★</span>
                          </span>
                        )}
                      </div>
                    )}
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
