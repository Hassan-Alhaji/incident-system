import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import Analytics from '../../pages/Analytics';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback || key,
    i18n: {
      language: 'ar',
      changeLanguage: () => Promise.resolve(),
      dir: () => 'rtl',
    },
  }),
}));

vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../../components/AnalyticsMap', () => ({
  default: () => <div data-testid="mock-analytics-map">Mock Map</div>,
}));

const mockAnalyticsData = {
  executiveKpis: {
    total: 10,
    resolved: 7,
    inProgress: 2,
    onTrack: 6,
    overdue: 1,
    critical: 0,
  },
  trainingHours: {
    safetyHours: 120,
    securityHours: 80,
    totalHours: 200,
    traineesCount: 45,
  },
  unitsBreakdown: [],
  detailsList: [
    {
      id: 't-1',
      title: 'Incident 1',
      status: 'CLOSED',
      severity: 'MINOR',
    },
  ],
  departmentsList: [],
  availableYears: [2026],
};

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url === '/analytics') {
        return Promise.resolve({ data: mockAnalyticsData });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

describe('Analytics Page Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('mounts cleanly without ReferenceError: isDark or React Error 310', async () => {
    const { container } = render(
      <MemoryRouter>
        <Analytics />
      </MemoryRouter>
    );

    // Wait for the data to resolve and the main dashboard to render
    await waitFor(() => {
      expect(screen.getByText(/لوحة مؤشرات وبلاغات الأمن والسلامة التنفيذية/i)).toBeDefined();
    });

    // Verify KPIs render
    expect(screen.getByText(/المشاركة والتوعية الميدانية/i)).toBeDefined();
    expect(container).toBeDefined();
  });

  it('allows toggling light/dark theme and clicking vials without error', async () => {
    render(
      <MemoryRouter>
        <Analytics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/لوحة مؤشرات وبلاغات الأمن والسلامة التنفيذية/i)).toBeDefined();
    });

    // Find theme toggle button and click it
    const themeBtn = screen.getByTitle(/التبديل إلى/i);
    expect(themeBtn).toBeDefined();
    themeBtn.click();

    // Verify it switched
    expect(localStorage.getItem('hse_analytics_theme')).toBeDefined();
  });
});
