
import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from './dashboard';

describe('Dashboard', () => {
  it('renders a welcome message', () => {
    const user = { email: 'test@example.com' };
    render(<Dashboard user={user} />);
    expect(
      screen.getByText('Welcome, test@example.com!')
    ).toBeInTheDocument();
  });
});
