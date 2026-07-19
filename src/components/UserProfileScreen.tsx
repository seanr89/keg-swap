import React from 'react';
import type { BeerEvent, BeerReview } from '../types';
import type { User } from 'firebase/auth';
import { ArrowLeft, Star, Beer, MessageSquare, Calendar, Award, CheckCircle, ChevronRight, UserCheck } from 'lucide-react';

interface UserProfileScreenProps {
  user: User;
  events: BeerEvent[];
  onBack: () => void;
  onNavigateToEvent: (eventId: string) => void;
}

interface UserReviewItem {
  review: BeerReview;
  drinkName: string;
  brewery: string;
  style: string;
  eventName: string;
  eventId: string;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  user,
  events,
  onBack,
  onNavigateToEvent,
}) => {
  // Aggregate reviews created by this user
  const userReviews: UserReviewItem[] = [];

  events.forEach((event) => {
    event.drinks?.forEach((drink) => {
      drink.reviews?.forEach((review) => {
        // Match by userId if present, otherwise fallback to reviewer name matching user's displayName or email
        const isUserReview = 
          (review.userId && review.userId === user.uid) ||
          (!review.userId && (
            review.reviewer === user.displayName || 
            review.reviewer === user.email
          ));

        if (isUserReview) {
          userReviews.push({
            review,
            drinkName: drink.name,
            brewery: drink.brewery,
            style: drink.style,
            eventName: event.name,
            eventId: event.id,
          });
        }
      });
    });
  });

  // Sort reviews by creation date descending
  userReviews.sort((a, b) => new Date(b.review.createdAt).getTime() - new Date(a.review.createdAt).getTime());

  // Take the last 10 reviews
  const recentReviews = userReviews.slice(0, 10);

  // Compute Statistics
  const totalReviews = userReviews.length;

  const avgRating = totalReviews > 0
    ? (userReviews.reduce((sum, item) => sum + item.review.rating, 0) / totalReviews).toFixed(1)
    : '0.0';

  const highestRating = totalReviews > 0
    ? Math.max(...userReviews.map((item) => item.review.rating))
    : 0;

  // Favorite style calculation
  const styleCounts: Record<string, number> = {};
  userReviews.forEach((item) => {
    if (item.style) {
      styleCounts[item.style] = (styleCounts[item.style] || 0) + 1;
    }
  });

  let favoriteStyle = 'None';
  let maxCount = 0;
  Object.entries(styleCounts).forEach(([style, count]) => {
    if (count > maxCount) {
      maxCount = count;
      favoriteStyle = style;
    }
  });

  // Unique beers tasted
  const uniqueBeers = new Set(userReviews.map((item) => `${item.drinkName}-${item.brewery}`));
  const totalUniqueBeers = uniqueBeers.size;

  // Events attending count
  const totalAttending = events.filter((event) => event.attendees?.includes(user.uid)).length;

  // Format account creation date
  const creationDate = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : 'Recently';

  return (
    <div className="profile-screen animate-fade-in">
      {/* Navigation & Header */}
      <div className="detail-navigation">
        <button type="button" className="btn-back" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div className="profile-layout-grid">
        {/* Left Side: Profile info card & statistics */}
        <div className="profile-sidebar-group">
          {/* User Card */}
          <div className="profile-card">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="profile-details">
              <h2 className="profile-name">{user.displayName || 'Ale Connoisseur'}</h2>
              <p className="profile-email">{user.email}</p>
              <div className="profile-meta-row">
                <Calendar size={14} className="profile-meta-icon" />
                <span>Joined {creationDate}</span>
              </div>
            </div>
          </div>

          {/* Stats Dashboard */}
          <div className="profile-stats-dashboard">
            <h3 className="sidebar-title">Stats Dashboard</h3>
            <div className="profile-stats-grid">
              
              <div className="profile-stat-box">
                <div className="stat-box-icon text-amber">
                  <MessageSquare size={20} />
                </div>
                <div className="stat-box-data">
                  <span className="stat-box-value">{totalReviews}</span>
                  <span className="stat-box-label">Total Reviews</span>
                </div>
              </div>

              <div className="profile-stat-box">
                <div className="stat-box-icon text-gold">
                  <Star size={20} fill="currentColor" />
                </div>
                <div className="stat-box-data">
                  <span className="stat-box-value">{avgRating}</span>
                  <span className="stat-box-label">Avg Rating Given</span>
                </div>
              </div>

              <div className="profile-stat-box">
                <div className="stat-box-icon text-beer">
                  <Beer size={20} />
                </div>
                <div className="stat-box-data">
                  <span className="stat-box-value">{totalUniqueBeers}</span>
                  <span className="stat-box-label">Beers Tasted</span>
                </div>
              </div>

              <div className="profile-stat-box">
                <div className="stat-box-icon text-emerald">
                  <Award size={20} />
                </div>
                <div className="stat-box-data">
                  <span className="stat-box-value" style={{ fontSize: '15px', fontWeight: 700 }}>{favoriteStyle}</span>
                  <span className="stat-box-label">Favorite Style</span>
                </div>
              </div>

              <div className="profile-stat-box">
                <div className="stat-box-icon text-amber">
                  <UserCheck size={20} />
                </div>
                <div className="stat-box-data">
                  <span className="stat-box-value">{totalAttending}</span>
                  <span className="stat-box-label">Events Attending</span>
                </div>
              </div>

            </div>

            {highestRating > 0 && (
              <div className="profile-achievement-card">
                <CheckCircle size={18} className="achievement-icon" />
                <span>Highest review rating given is <strong>{highestRating} {highestRating === 1 ? 'star' : 'stars'}</strong>!</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Recent Reviews Feed */}
        <div className="profile-feed-group">
          <div className="feed-header-row">
            <h3 className="section-title" style={{ margin: 0 }}>Recent Reviews</h3>
            <span className="feed-count-badge">Showing last {recentReviews.length} of {totalReviews}</span>
          </div>

          {recentReviews.length > 0 ? (
            <div className="profile-reviews-list">
              {recentReviews.map(({ review, drinkName, brewery, style, eventName, eventId }) => (
                <div key={review.id} className="profile-review-card">
                  <div className="profile-review-header">
                    <div>
                      <div className="profile-review-beer-row">
                        <h4 className="profile-review-beer-name">{drinkName}</h4>
                        <span className="profile-review-beer-style">{style}</span>
                      </div>
                      <p className="profile-review-brewery">by {brewery}</p>
                    </div>

                    <div className="profile-review-stars">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={13}
                          className={i < review.rating ? 'star-filled' : 'star-empty'}
                          fill={i < review.rating ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="profile-review-comment">"{review.comment}"</p>

                  <div className="profile-review-footer">
                    <span className="profile-review-date">
                      {new Date(review.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>

                    <button
                      type="button"
                      className="btn-profile-event-link"
                      onClick={() => onNavigateToEvent(eventId)}
                      title={`Go to ${eventName}`}
                    >
                      <span>at {eventName}</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="profile-reviews-empty">
              <Beer className="empty-icon animate-float" size={48} />
              <h4>No reviews yet</h4>
              <p>When you start writing reviews at events, your recent tasting log will appear here!</p>
              <button type="button" className="btn-secondary" onClick={onBack} style={{ marginTop: '16px' }}>
                Find Events to Review
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
