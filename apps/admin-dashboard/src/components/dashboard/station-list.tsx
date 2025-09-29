'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '@ev-platform/ui';
import { EyeIcon, PencilIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface Station {
  id: string;
  name: string;
  address: string;
  totalPorts: number;
  availablePorts: number;
  status: 'online' | 'offline' | 'maintenance';
  revenue: number;
  utilization: number;
}

const mockStations: Station[] = [
  {
    id: '1',
    name: 'Downtown Station Alpha',
    address: '123 Main St, Downtown',
    totalPorts: 8,
    availablePorts: 3,
    status: 'online',
    revenue: 1250,
    utilization: 0.75,
  },
  {
    id: '2',
    name: 'Mall Charging Hub',
    address: '456 Shopping Blvd, Midtown',
    totalPorts: 12,
    availablePorts: 7,
    status: 'online',
    revenue: 2150,
    utilization: 0.58,
  },
  {
    id: '3',
    name: 'Highway Rest Stop',
    address: '789 Interstate Dr, Highway',
    totalPorts: 6,
    availablePorts: 0,
    status: 'maintenance',
    revenue: 890,
    utilization: 1.0,
  },
];

export function StationList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredStations = mockStations.filter(station => {
    const matchesSearch = station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         station.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || station.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Station['status']) => {
    switch (status) {
      case 'online':
        return <Badge variant="success">Online</Badge>;
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>;
      case 'maintenance':
        return <Badge variant="warning">Maintenance</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Input
          placeholder="Search stations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Stations</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {/* Station Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredStations.map((station) => (
          <Card key={station.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{station.name}</CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPinIcon className="h-4 w-4" />
                    {station.address}
                  </div>
                </div>
                {getStatusBadge(station.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Port Status */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Ports</p>
                  <p className="font-semibold">{station.totalPorts}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Available</p>
                  <p className="font-semibold text-green-600">{station.availablePorts}</p>
                </div>
              </div>

              {/* Utilization Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="font-medium">{Math.round(station.utilization * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${station.utilization * 100}%` }}
                  />
                </div>
              </div>

              {/* Revenue */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Today's Revenue</span>
                <span className="font-semibold">${station.revenue}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <EyeIcon className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStations.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No stations found matching your criteria.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}