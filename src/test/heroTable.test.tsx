import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroTable, HeroTableColumn } from '../components/template/HeroTable';

interface TestItem {
  id: number;
  name: string;
  matches: number;
  score: number;
}

const mockColumns: HeroTableColumn<TestItem>[] = [
  {
    key: 'name',
    header: 'Hero Name',
    sortField: 'name',
    render: (item) => <span data-testid={`hero-${item.id}`}>{item.name}</span>,
  },
  {
    key: 'matches',
    header: 'Matches Played',
    sortField: 'matches',
    render: (item) => <span>{item.matches}</span>,
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    render: (item) => <span>{item.score} pts</span>,
  },
];

const mockData: TestItem[] = [
  { id: 1, name: 'Abrams', matches: 10, score: 75 },
  { id: 2, name: 'Bebop', matches: 8, score: 60 },
  { id: 3, name: 'Dynamo', matches: 1, score: 50 },
];

describe('HeroTable component', () => {
  it('renders all column headers and data rows correctly', () => {
    render(
      <HeroTable<TestItem>
        data={mockData}
        columns={mockColumns}
        getRowKey={(item) => item.id}
      />
    );

    expect(screen.getByText('Hero Name')).toBeDefined();
    expect(screen.getByText('Matches Played')).toBeDefined();
    expect(screen.getByText('Score')).toBeDefined();
    expect(screen.getByText('Abrams')).toBeDefined();
    expect(screen.getByText('Bebop')).toBeDefined();
    expect(screen.getByText('Dynamo')).toBeDefined();
  });

  it('renders headerContent when provided', () => {
    render(
      <HeroTable<TestItem>
        data={mockData}
        columns={mockColumns}
        getRowKey={(item) => item.id}
        headerContent={<div data-testid="custom-toolbar">Custom Controls</div>}
      />
    );

    expect(screen.getByTestId('custom-toolbar')).toBeDefined();
    expect(screen.getByText('Custom Controls')).toBeDefined();
  });

  it('calls onSort with column sortField on header click', () => {
    const handleSort = vi.fn();
    render(
      <HeroTable<TestItem>
        data={mockData}
        columns={mockColumns}
        getRowKey={(item) => item.id}
        sortField="name"
        sortAsc={true}
        onSort={handleSort}
      />
    );

    const matchesHeader = screen.getByText('Matches Played');
    fireEvent.click(matchesHeader);

    expect(handleSort).toHaveBeenCalledWith('matches');
  });

  it('displays low-sample delimiter when low-sample items exist', () => {
    render(
      <HeroTable<TestItem>
        data={mockData}
        columns={mockColumns}
        getRowKey={(item) => item.id}
        isLowSample={(item) => item.matches < 3}
        threshold={3}
      />
    );

    expect(
      screen.getByText(/Low Sample Size \(< 3 matches\)/i)
    ).toBeDefined();
  });

  it('displays emptyMessage when dataset is empty', () => {
    render(
      <HeroTable<TestItem>
        data={[]}
        columns={mockColumns}
        getRowKey={(item) => item.id}
        emptyMessage="Custom empty message"
      />
    );

    expect(screen.getByText('Custom empty message')).toBeDefined();
  });

  it('handles row click when onRowClick is provided', () => {
    const handleRowClick = vi.fn();
    render(
      <HeroTable<TestItem>
        data={mockData}
        columns={mockColumns}
        getRowKey={(item) => item.id}
        onRowClick={handleRowClick}
      />
    );

    const rowItem = screen.getByText('Abrams');
    fireEvent.click(rowItem.closest('tr')!);

    expect(handleRowClick).toHaveBeenCalledWith(mockData[0], false);
  });
});
