import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import CloseTicketModal from '../../components/ticket/CloseTicketModal';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the react-i18next translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: () => Promise.resolve(),
      dir: () => 'ltr',
    },
  }),
}));

// Mock the API layer to avoid actual network requests
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

describe('CloseTicketModal Component', () => {
  const serviceProviders = [
    { id: 'sp-1', name: 'Contractor Alpha', nameAr: 'المقاول ألفا' },
    { id: 'sp-2', name: 'Contractor Beta', nameAr: 'المقاول بيتا' },
  ];

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders and allows choosing a service provider and triggers onConfirm with correct payload', () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <CloseTicketModal
        open={true}
        serviceProviderId="sp-1"
        serviceProviderName="Contractor Alpha"
        serviceProviders={serviceProviders}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    );

    // Verify it is rendered
    expect(screen.getByText('Close Ticket')).toBeTruthy();

    // Check if the service provider dropdown lists options
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('sp-1');

    // Select Contractor Beta (sp-2)
    fireEvent.change(select, { target: { value: 'sp-2' } });
    expect(select.value).toBe('sp-2');

    // Click on "None" violation type to satisfy canSubmit
    const noneViolationBtn = screen.getByText('None');
    expect(noneViolationBtn).toBeTruthy();
    fireEvent.click(noneViolationBtn);

    // Confirm close button should be enabled and click it
    const confirmBtn = screen.getByText('Confirm & Close');
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn.removeAttribute('disabled')).toBeUndefined();
    fireEvent.click(confirmBtn);

    // Verify onConfirm was called with the updated serviceProviderId ("sp-2")
    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleConfirm).toHaveBeenCalledWith({
      violationType: 'NONE',
      violationDescription: '',
      violationAmount: '',
      serviceProviderId: 'sp-2',
    });
  });
});
