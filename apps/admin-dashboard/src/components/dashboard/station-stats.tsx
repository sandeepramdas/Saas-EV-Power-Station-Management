'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@ev-platform/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const revenueData = [
  { month: 'Jan', revenue: 12500, sessions: 450 },
  { month: 'Feb', revenue: 15600, sessions: 520 },
  { month: 'Mar', revenue: 18200, sessions: 680 },
  { month: 'Apr', revenue: 22100, sessions: 750 },
  { month: 'May', revenue: 19800, sessions: 690 },
  { month: 'Jun', revenue: 25400, sessions: 820 },
];

const usageData = [
  { hour: '00:00', usage: 12 },
  { hour: '06:00', usage: 45 },
  { hour: '12:00', usage: 78 },
  { hour: '18:00', usage: 92 },
  { hour: '21:00', usage: 65 },
];

export function StationStats() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue & Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily Usage Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={usageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="usage" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Average Session Duration</p>
              <p className="text-2xl font-bold">2h 34m</p>
              <p className="text-xs text-green-600">+12% vs last month</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Energy Delivered</p>
              <p className="text-2xl font-bold">12,847 kWh</p>
              <p className="text-xs text-green-600">+8% vs last month</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Customer Satisfaction</p>
              <p className="text-2xl font-bold">4.8/5</p>
              <p className="text-xs text-green-600">+0.2 vs last month</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}