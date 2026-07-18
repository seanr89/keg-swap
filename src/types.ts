export interface BeerReview {
  id: string;
  reviewer: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
  userId?: string;
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
}
