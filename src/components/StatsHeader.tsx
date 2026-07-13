import React from 'react';
import type { BeerEvent } from '../types';
import { Beer, Calendar, Play, CheckCircle } from 'lucide-react';

interface StatsHeaderProps {
  events: BeerEvent[];
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({ events }) => {
  const total = events.length;
  const upcoming = events.filter((e) => e.status === 'Upcoming').length;
  const ongoing = events.filter((e) => e.status === 'Ongoing').length;
  const completed = events.filter((e) => e.status === 'Completed').length;

  return (
    <div className="stats-container">
      <div className="stat-card">
        <div className="stat-icon-wrapper total">
          <Beer className="stat-icon" size={24} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Total Events</span>
          <span className="stat-value">{total}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper upcoming">
          <Calendar className="stat-icon" size={24} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Upcoming</span>
          <span className="stat-value">{upcoming}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper ongoing">
          <Play className="stat-icon" size={24} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Active Now</span>
          <span className="stat-value">{ongoing}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper completed">
          <CheckCircle className="stat-icon" size={24} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Completed</span>
          <span className="stat-value">{completed}</span>
        </div>
      </div>
    </div>
  );
};
