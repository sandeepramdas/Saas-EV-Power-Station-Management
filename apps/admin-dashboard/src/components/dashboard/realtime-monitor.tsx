'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@ev-platform/ui';
import { BoltIcon, ClockIcon, UserIcon } from '@heroicons/react/24/outline';

interface ActiveSession {
  id: string;
  stationName: string;
  portNumber: number;
  customerName: string;
  vehicleModel: string;
  startTime: Date;
  currentEnergy: number;
  targetEnergy: number;
  chargingRate: number;
  estimatedCompletion: Date;
  status: 'charging' | 'completing' | 'error';
}

const mockSessions: ActiveSession[] = [
  {
    id: '1',
    stationName: 'Downtown Station Alpha',
    portNumber: 3,
    customerName: 'John Doe',
    vehicleModel: 'Tesla Model 3',
    startTime: new Date(Date.now() - 1800000), // 30 mins ago
    currentEnergy: 45.5,
    targetEnergy: 75.0,
    chargingRate: 22.5,
    estimatedCompletion: new Date(Date.now() + 2100000), // 35 mins from now
    status: 'charging',
  },
  {
    id: '2',
    stationName: 'Mall Charging Hub',
    portNumber: 7,
    customerName: 'Jane Smith',
    vehicleModel: 'BMW iX',
    startTime: new Date(Date.now() - 2700000), // 45 mins ago
    currentEnergy: 68.2,
    targetEnergy: 80.0,
    chargingRate: 18.0,
    estimatedCompletion: new Date(Date.now() + 900000), // 15 mins from now
    status: 'charging',
  },
  {
    id: '3',
    stationName: 'Downtown Station Alpha',
    portNumber: 1,
    customerName: 'Mike Johnson',
    vehicleModel: 'Ford Mustang Mach-E',
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    currentEnergy: 89.5,
    targetEnergy: 90.0,
    chargingRate: 5.2,
    estimatedCompletion: new Date(Date.now() + 300000), // 5 mins from now
    status: 'completing',
  },
];

export function RealtimeMonitor() {
  const [sessions, setSessions] = useState<ActiveSession[]>(mockSessions);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      // Simulate real-time updates
      setSessions(prev => prev.map(session => ({
        ...session,
        currentEnergy: Math.min(
          session.targetEnergy,
          session.currentEnergy + (session.chargingRate / 3600) * 5 // 5 second intervals
        ),
      })));
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const getStatusBadge = (status: ActiveSession['status']) => {
    switch (status) {
      case 'charging':
        return <Badge variant="info">Charging</Badge>;
      case 'completing':
        return <Badge variant="warning">Completing</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatDuration = (startTime: Date) => {
    const diff = currentTime.getTime() - startTime.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const formatTimeRemaining = (estimatedCompletion: Date) => {
    const diff = estimatedCompletion.getTime() - currentTime.getTime();
    if (diff <= 0) return 'Complete';

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <BoltIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Power Output</CardTitle>
            <BoltIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessions.reduce((sum, session) => sum + session.chargingRate, 0).toFixed(1)} kW
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Session Time</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1h 45m</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BoltIcon className="h-5 w-5" />
            Active Charging Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{session.stationName} - Port {session.portNumber}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <UserIcon className="h-4 w-4" />
                        {session.customerName}
                      </div>
                      <span>{session.vehicleModel}</span>
                    </div>
                  </div>
                  {getStatusBadge(session.status)}
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Energy Progress</span>
                    <span className="font-medium">
                      {session.currentEnergy.toFixed(1)} / {session.targetEnergy} kWh
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${(session.currentEnergy / session.targetEnergy) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Charging Rate</p>
                    <p className="font-semibold">{session.chargingRate} kW</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-semibold">{formatDuration(session.startTime)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Time Remaining</p>
                    <p className="font-semibold">{formatTimeRemaining(session.estimatedCompletion)}</p>
                  </div>
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No active charging sessions
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}