export interface BeerReview {
  id: string;
  reviewer: string;
  rating: number; // 0.5 - 10.0 (supports 0.5 step half ratings)
  comment: string;
  createdAt: string;
  userId?: string;
  price?: string;
  servingSize?: string;
  imageUrl?: string;
}

export interface BeerDrink {
  id: string;
  name: string;
  brewery: string;
  location: string;
  abv: string;
  style: string;
  description: string;
  reviews: BeerReview[];
  imageUrl?: string;
}

export interface BeerEvent {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  address: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  drinks?: BeerDrink[];
  attendees?: string[];
  url?: string;
  mapsUrl?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  isPublic: boolean;
  friends?: string[];
  createdAt?: string;
}

export interface EventLocation {
  id: string;
  name: string;
  address: string;
  city?: string;
  postcode?: string;
  mapsUrl?: string;
  website?: string;
  notes?: string;
  createdAt: string;
}

