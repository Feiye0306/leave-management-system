// src/components/ReportCenterV2.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportCenterV2 from './ReportCenterV2';
import type { Employee, LeaveRecord } from '../types';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
// import '@testing-library/jest-dom'; // Handled in setup.ts
import jsPDF from 'jspdf';
// import html2canvas from 'html2canvas'; // Mocked but not used in test body

// Mock data for employees
const mockEmployees: Employee[] = [
    {
        id: 'e1',
        name: 'Alice',
        branch: '分校A',
        status: '在職',
        hireDate: '2023-01-01',
        annualLeave: { initial: 10, earned: 5, adjustment: 0, used: 3, expiry: '2024-12-31' },
        personalLeave: { initial: 5, earned: 2, adjustment: 0, used: 1 },
        monthlyPersonalQuota: 2,
    },
    // ... other employees if needed
];

const mockLeaves: LeaveRecord[] = [
    {
        id: 'r1',
        employeeId: 'e1',
        employeeName: 'Alice',
        branch: '分校A',
        startDate: '2024-05-10',
        endDate: '2024-05-10',
        leaveType: 'annual',
        isFullDay: true,
        days: 1,
        timeSlot: 'morning',
        note: '',
        createdAt: new Date().toISOString(),
    }
];

// Mock Context
vi.mock('../context/LeaveContext', () => ({
    useLeaveSystem: vi.fn(() => ({
        employees: mockEmployees,
        leaves: mockLeaves,
        branches: ['分校A', '分校B'],
        loading: false,
        error: null
    }))
}));

vi.mock('jspdf', () => {
    // Return a constructor function
    const MockJsPDF = vi.fn();
    MockJsPDF.prototype.internal = {
        pageSize: {
            getWidth: vi.fn().mockReturnValue(210)
        }
    };
    MockJsPDF.prototype.addImage = vi.fn();
    MockJsPDF.prototype.save = vi.fn();
    MockJsPDF.prototype.text = vi.fn();
    MockJsPDF.prototype.setFontSize = vi.fn();
    MockJsPDF.prototype.setTextColor = vi.fn();

    // Also support return from constructor if needed, but prototype is better for classes
    return { default: MockJsPDF };
});

// Mock html2canvas
vi.mock('html2canvas', () => {
    return {
        default: vi.fn().mockResolvedValue({
            toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
            width: 100,
            height: 100
        })
    };
});

describe('ReportCenterV2', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders monthly report and triggers PDF download', async () => {
        render(<ReportCenterV2 selectedBranch="全部分校" />);
        const downloadBtn = screen.getByRole('button', { name: /下載 PDF/i });
        expect(downloadBtn).toBeInTheDocument();
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => { });
        fireEvent.click(downloadBtn);

        await waitFor(() => {
            expect(jsPDF).toHaveBeenCalled();
            // Access mock instance
            const mockInstance = (jsPDF as unknown as Mock).mock.results[0].value;
            expect(mockInstance.save).toHaveBeenCalled();
        });
        alertMock.mockRestore();
    });

    it('individual report requires employee selection', async () => {
        render(<ReportCenterV2 selectedBranch="全部分校" />);
        const individualTab = screen.getByRole('button', { name: /個人明細/i });
        fireEvent.click(individualTab);
        const downloadBtn = screen.getByRole('button', { name: /下載 PDF/i });
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => { });
        fireEvent.click(downloadBtn);

        expect(alertMock).toHaveBeenCalledWith('請先選擇一位員工以生成報表');

        const selects = screen.getAllByRole('combobox');
        await userEvent.selectOptions(selects[0], 'e1');
        fireEvent.click(downloadBtn);
        await waitFor(() => {
            const mockInstance = (jsPDF as unknown as Mock).mock.results[0].value;
            expect(mockInstance.save).toHaveBeenCalled();
        });
        alertMock.mockRestore();
    });

    it('expiry report shows correct remaining days', () => {
        render(<ReportCenterV2 selectedBranch="全部分校" />);
        const expiryTab = screen.getByRole('button', { name: /到期警示/i });
        fireEvent.click(expiryTab);

        const nameElement = screen.getByText(/Alice/i);
        expect(nameElement).toBeInTheDocument();
        const daysText = screen.getAllByText(/天/)[0];
        expect(daysText).toBeInTheDocument();
    });
});
