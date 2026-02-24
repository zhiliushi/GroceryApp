export interface LocationConfig {
  icon: string;
  color: string;
  label: string;
}

const KNOWN_CONFIGS: Record<string, LocationConfig> = {
  fridge: {icon: 'fridge-outline', color: '#4A80C4', label: 'Fridge'},
  pantry: {icon: 'cabinet', color: '#C4873B', label: 'Pantry'},
  freezer: {icon: 'snowflake', color: '#4A9EA8', label: 'Freezer'},
  garage: {icon: 'garage', color: '#7A6B60', label: 'Garage'},
  basement: {icon: 'stairs-down', color: '#6B7D87', label: 'Basement'},
};

export function getLocationConfig(location: string): LocationConfig {
  return KNOWN_CONFIGS[location] ?? {
    icon: 'package-variant',
    color: '#6B7D87',
    label: location.charAt(0).toUpperCase() + location.slice(1),
  };
}

export function capitaliseLocation(location: string): string {
  return location.charAt(0).toUpperCase() + location.slice(1);
}
