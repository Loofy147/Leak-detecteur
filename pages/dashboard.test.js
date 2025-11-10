
import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from './dashboard';

describe('Dashboard', () => {
  it('renders a welcome message', () => {
    render(<Dashboard />);
    expect(
      screen.getByText('Welcome to your subscription management dashboard.')
    ).toBeInTheDocument();
  });
});
