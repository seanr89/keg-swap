import React from 'react';
import type { BeerEvent, BeerReview, UserProfile } from '../types';
import type { User } from 'firebase/auth';
import { 
  ArrowLeft, 
  Beer, 
  MessageSquare, 
  Calendar, 
  Award, 
  CheckCircle, 
  ChevronRight, 
  UserCheck, 
  Globe, 
  Lock, 
  Users, 
  UserPlus, 
  UserMinus,
  MapPin,
  Camera,
  X
} from 'lucide-react';
import { StarRating } from './StarRating';

interface UserProfileScreenProps {
  user: User;
  userProfile: UserProfile | null;
  allUsers: UserProfile[];
  events: BeerEvent[];
  onBack: () => void;
  onNavigateToEvent: (eventId: string) => void;
  onTogglePrivacy: () => void;
  onOpenSearchModal: () => void;
  onRemoveFriend: (friendUid: string) => void;
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
  userProfile,
  allUsers,
  events,
  onBack,
  onNavigateToEvent,
  onTogglePrivacy,
  onOpenSearchModal,
  onRemoveFriend,
}) => {
  const [lightboxImage, setLightboxImage] = React.useState<{ url: string; title: string; subtitle?: string } | null>(null);

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

  // Events attended/attending calculation
  const attendedEvents = events.filter(
    (event) => event.attendees?.includes(user.uid) || userReviews.some((ur) => ur.eventId === event.id)
  );

  // Sort attended events by date descending
  attendedEvents.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  });

  const totalAttending = attendedEvents.length;

  // Format account creation date
  const creationDate = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : 'Recently';

  const isPublic = userProfile?.isPublic !== false;
  const friendUids = userProfile?.friends || [];

  // Resolve friend profile details from allUsers
  const friendProfiles = friendUids.map((uid) => {
    const found = allUsers.find((u) => u.uid === uid);
    return (
      found || {
        uid,
        displayName: 'User',
        email: 'Member',
        isPublic: true,
      }
    );
  });

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
        {/* Left Side: Profile info card, privacy settings, friends & statistics */}
        <div className="profile-sidebar-group">
          {/* User Card */}
          <div className="profile-card">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="profile-details">
              <div className="profile-name-row">
                <h2 className="profile-name">{user.displayName || 'Ale Connoisseur'}</h2>
                <span className={`privacy-badge ${isPublic ? 'badge-public' : 'badge-private'}`}>
                  {isPublic ? <Globe size={12} /> : <Lock size={12} />}
                  <span>{isPublic ? 'Public' : 'Private'}</span>
                </span>
              </div>
              <p className="profile-email">{user.email}</p>
              <div className="profile-meta-row">
                <Calendar size={14} className="profile-meta-icon" />
                <span>Joined {creationDate}</span>
              </div>
            </div>
          </div>

          {/* Privacy Toggle Card */}
          <div className="privacy-settings-card">
            <div className="privacy-settings-header">
              <div>
                <h4 className="privacy-title">Account Privacy</h4>
                <p className="privacy-desc">
                  {isPublic
                    ? 'Your profile is public. Other users can find and add you as a friend.'
                    : 'Your profile is private. You will not appear in user search results.'}
                </p>
              </div>
              <button
                type="button"
                className={`btn-privacy-toggle ${isPublic ? 'active' : ''}`}
                onClick={onTogglePrivacy}
                title={isPublic ? 'Switch to Private profile' : 'Switch to Public profile'}
              >
                {isPublic ? <Globe size={16} /> : <Lock size={16} />}
                <span>{isPublic ? 'Public Account' : 'Private Account'}</span>
              </button>
            </div>
          </div>

          {/* Friends List Dashboard */}
          <div className="profile-stats-dashboard friends-dashboard">
            <div className="sidebar-header-with-action">
              <div className="title-with-badge">
                <Users size={18} className="text-amber" />
                <h3 className="sidebar-title" style={{ margin: 0 }}>Friends</h3>
                <span className="friends-count-pill">{friendProfiles.length}</span>
              </div>
              <button
                type="button"
                className="btn-primary btn-small"
                onClick={onOpenSearchModal}
              >
                <UserPlus size={14} />
                <span>Find Friends</span>
              </button>
            </div>

            {friendProfiles.length > 0 ? (
              <div className="friends-list-grid">
                {friendProfiles.map((friend) => {
                  const avatarLetter = friend.displayName
                    ? friend.displayName.charAt(0).toUpperCase()
                    : friend.email
                    ? friend.email.charAt(0).toUpperCase()
                    : 'F';

                  return (
                    <div key={friend.uid} className="friend-card-item">
                      <div className="friend-info">
                        <div className="friend-avatar">{avatarLetter}</div>
                        <div className="friend-details">
                          <span className="friend-name">{friend.displayName}</span>
                          <span className="friend-email">{friend.email}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-remove-friend"
                        onClick={() => onRemoveFriend(friend.uid)}
                        title={`Remove ${friend.displayName} from friends`}
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="friends-empty-state">
                <p>No friends added yet. Click <strong>"Find Friends"</strong> to search and add public users!</p>
              </div>
            )}
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
                  <Beer size={20} fill="currentColor" />
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
                <span>Highest review rating given is <strong>{highestRating.toFixed(1)} / 10</strong>!</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Attended Events & Recent Reviews Feed */}
        <div className="profile-feed-group">
          {/* Attended Events Section */}
          <div className="profile-feed-section">
            <div className="feed-header-row">
              <h3 className="section-title" style={{ margin: 0 }}>Attended Events</h3>
              <span className="feed-count-badge">
                {attendedEvents.length} {attendedEvents.length === 1 ? 'Event' : 'Events'}
              </span>
            </div>

            {attendedEvents.length > 0 ? (
              <div className="profile-events-list">
                {attendedEvents.map((event) => {
                  const drinksCount = event.drinks?.length || 0;
                  const attendeesCount = event.attendees?.length || 0;
                  const userReviewCountInEvent = userReviews.filter((ur) => ur.eventId === event.id).length;
                  const formattedDate = event.date
                    ? new Date(event.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Date TBD';

                  return (
                    <div key={event.id} className="profile-event-card">
                      <div className="profile-event-header">
                        <div style={{ flex: 1 }}>
                          <div className="profile-event-title-row">
                            <h4 className="profile-event-name">{event.name}</h4>
                            <span className={`status-badge status-${event.status.toLowerCase()}`}>
                              {event.status}
                            </span>
                          </div>
                          <div className="profile-event-meta-info">
                            <span className="event-meta-item">
                              <Calendar size={13} />
                              <span>{formattedDate}</span>
                            </span>
                            {event.address && (
                              <span className="event-meta-item">
                                <MapPin size={13} />
                                <span>{event.address}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="profile-event-footer">
                        <div className="profile-event-badges">
                          <span className="event-stat-chip">
                            <Beer size={12} />
                            <span>{drinksCount} {drinksCount === 1 ? 'Beer' : 'Beers'}</span>
                          </span>
                          <span className="event-stat-chip">
                            <Users size={12} />
                            <span>{attendeesCount} {attendeesCount === 1 ? 'Attendee' : 'Attendees'}</span>
                          </span>
                          {userReviewCountInEvent > 0 && (
                            <span className="event-stat-chip chip-highlight">
                              <MessageSquare size={12} />
                              <span>{userReviewCountInEvent} {userReviewCountInEvent === 1 ? 'Review' : 'Reviews'}</span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="btn-profile-event-link"
                          onClick={() => onNavigateToEvent(event.id)}
                          title={`Go to ${event.name}`}
                        >
                          <span>View Event</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="profile-reviews-empty">
                <Calendar className="empty-icon animate-float" size={48} />
                <h4>No attended events yet</h4>
                <p>When you join or attend events, they will appear here in your activity log!</p>
                <button type="button" className="btn-secondary" onClick={onBack} style={{ marginTop: '16px' }}>
                  Explore Events
                </button>
              </div>
            )}
          </div>

          {/* Recent Reviews Section */}
          <div className="profile-feed-section">
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
                          {review.servingSize && <span className="review-meta-tag">{review.servingSize}</span>}
                          {review.price && <span className="review-meta-tag price">{review.price}</span>}
                        </div>
                        <p className="profile-review-brewery">by {brewery}</p>
                      </div>

                      <div className="profile-review-stars" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <StarRating rating={review.rating} maxStars={10} size={12} />
                        <span className="profile-review-rating-num" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {review.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <p className="profile-review-comment">"{review.comment}"</p>

                    {review.imageUrl && (
                      <div className="review-photo-container" style={{ marginTop: '10px' }}>
                        <img
                          src={review.imageUrl}
                          alt="Tasting photo"
                          className="review-photo-thumb"
                          onClick={() => setLightboxImage({ url: review.imageUrl!, title: `${drinkName} Photo`, subtitle: `Tasted by ${user.displayName || 'User'} at ${eventName}` })}
                          title="Click to view full photo"
                        />
                        <span className="review-photo-caption">
                          <Camera size={12} /> Drink photo attached
                        </span>
                      </div>
                    )}

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

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setLightboxImage(null)}
              aria-label="Close photo modal"
            >
              <X size={20} />
            </button>
            <img src={lightboxImage.url} alt={lightboxImage.title} className="lightbox-img" />
            <div className="lightbox-caption">
              <h4>{lightboxImage.title}</h4>
              {lightboxImage.subtitle && <p>{lightboxImage.subtitle}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

