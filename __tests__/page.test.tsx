import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '@/app/page';
import { expect, test, vi, beforeEach, describe } from 'vitest';

const mockCustomers = {
  data: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ],
  meta: {
    total: 2,
    page: 1,
    limit: 15,
    totalPages: 1,
  },
};

const mockIdleCampaignStatus = {
  status: 'idle',
  percentage: 0,
  totalBatches: 0,
  completedBatches: 0,
  failedBatches: 0,
  activeBatches: 0,
  waitingBatches: 0,
};

describe('Home Page Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('renders customer directory and progress dashboard', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('/api/customers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCustomers),
        } as Response);
      }
      if (url.toString().includes('/api/campaign/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockIdleCampaignStatus),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<Home />);

    expect(screen.getByText('Campaign Mailer')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  test('handles select all and individual selection updates trigger button text', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('/api/customers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCustomers),
        } as Response);
      }
      if (url.toString().includes('/api/campaign/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockIdleCampaignStatus),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const triggerBtn = screen.getByRole('button', { name: /Email|Select/i });
    expect(triggerBtn).toBeDisabled();

    // Select Alice (individual)
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "Select All" in header, second is Alice, third is Bob.
    fireEvent.click(checkboxes[1]);
    expect(triggerBtn).not.toBeDisabled();
    expect(triggerBtn).toHaveTextContent('Send Email to 1 Selected');

    // Checkbox on Header Row -> Click "Select All"
    fireEvent.click(checkboxes[0]);
    expect(triggerBtn).toHaveTextContent('Send Email to ALL Customers');
  });

  test('submits post request when triggering email campaign', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('/api/customers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCustomers),
        } as Response);
      }
      if (url.toString().includes('/api/campaign/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockIdleCampaignStatus),
        } as Response);
      }
      if (url.toString().includes('/api/campaign/trigger')) {
        return Promise.resolve({
          ok: true,
          status: 202,
          json: () => Promise.resolve({ message: 'Queued' }),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Select all

    const triggerBtn = screen.getByRole('button', { name: /Email|Select/i });
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaign/trigger', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sendToAll: true, customerIds: [] }),
      }));
    });
  });
});
