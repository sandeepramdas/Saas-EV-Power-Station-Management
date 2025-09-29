import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

interface Station {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  availablePorts: number;
  totalPorts: number;
  distance?: number;
}

const mockStations: Station[] = [
  {
    id: '1',
    name: 'Downtown Station Alpha',
    address: '123 Main St, Downtown',
    latitude: 37.7749,
    longitude: -122.4194,
    availablePorts: 3,
    totalPorts: 8,
  },
  {
    id: '2',
    name: 'Mall Charging Hub',
    address: '456 Shopping Blvd, Midtown',
    latitude: 37.7849,
    longitude: -122.4094,
    availablePorts: 7,
    totalPorts: 12,
  },
  {
    id: '3',
    name: 'Highway Rest Stop',
    address: '789 Interstate Dr, Highway',
    latitude: 37.7649,
    longitude: -122.4294,
    availablePorts: 0,
    totalPorts: 6,
  },
];

export function StationMapScreen() {
  const [region, setRegion] = useState<Region>({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to show nearby stations');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setLoading(false);
    }
  };

  const onMarkerPress = (station: Station) => {
    setSelectedStation(station);
  };

  const getMarkerColor = (availablePorts: number, totalPorts: number) => {
    const ratio = availablePorts / totalPorts;
    if (ratio > 0.5) return '#22c55e'; // Green
    if (ratio > 0) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Finding nearby stations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {mockStations.map((station) => (
          <Marker
            key={station.id}
            coordinate={{
              latitude: station.latitude,
              longitude: station.longitude,
            }}
            pinColor={getMarkerColor(station.availablePorts, station.totalPorts)}
            onPress={() => onMarkerPress(station)}
          >
            <View style={styles.markerContainer}>
              <Ionicons
                name="flash"
                size={24}
                color={getMarkerColor(station.availablePorts, station.totalPorts)}
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Station Info Card */}
      {selectedStation && (
        <View style={styles.stationCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.stationName}>{selectedStation.name}</Text>
            <TouchableOpacity
              onPress={() => setSelectedStation(null)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.stationAddress}>{selectedStation.address}</Text>

          <View style={styles.availabilityContainer}>
            <View style={styles.availabilityItem}>
              <Text style={styles.availabilityLabel}>Available Ports</Text>
              <Text style={[styles.availabilityValue, { color: '#22c55e' }]}>
                {selectedStation.availablePorts}
              </Text>
            </View>
            <View style={styles.availabilityItem}>
              <Text style={styles.availabilityLabel}>Total Ports</Text>
              <Text style={styles.availabilityValue}>{selectedStation.totalPorts}</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.directionsButton}>
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.buttonText}>Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.bookButton,
                selectedStation.availablePorts === 0 && styles.disabledButton,
              ]}
              disabled={selectedStation.availablePorts === 0}
            >
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.buttonText}>
                {selectedStation.availablePorts > 0 ? 'Book Now' : 'Full'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search/Filter Button */}
      <TouchableOpacity style={styles.searchButton}>
        <Ionicons name="search" size={24} color="#fff" />
      </TouchableOpacity>

      {/* My Location Button */}
      <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
        <Ionicons name="locate" size={24} color="#22c55e" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  markerContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  stationCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stationName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  stationAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  availabilityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  availabilityItem: {
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  availabilityValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  directionsButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  bookButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  searchButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: '#22c55e',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  locationButton: {
    position: 'absolute',
    bottom: selectedStation ? 200 : 60,
    right: 20,
    backgroundColor: '#fff',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});