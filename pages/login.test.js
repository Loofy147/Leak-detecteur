
import React from 'react';
import { render, screen } from '@testing-library/react';
import Login from './login';

jest.mock('../lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  }),
}));

describe('Login', () => {
  it('renders a login form', () => {
    render(<Login />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });
});
