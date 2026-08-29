// jest.setup.ts
// Mock html2canvas and jsPDF for tests

jest.mock('html2canvas', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({
    toDataURL: () => 'data:image/png;base64,TEST',
    width: 800,
    height: 600,
  })),
}));

jest.mock('jspdf', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addImage: jest.fn(),
    save: jest.fn(),
  })),
}));
