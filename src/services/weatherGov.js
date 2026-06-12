// This module owns all weather-related API calls and response normalization.
//
// WHY keep this separate from App:
// - UI components stay focused on rendering.
// - Network and data-shaping logic can be tested/refactored independently.
// - App can call a simple function and receive UI-friendly objects.

const WEATHER_HEADERS = {
  Accept: "application/geo+json",
};

// NOTE:
// In production, this should be moved to an environment variable.
const OPENWEATHER_API_KEY = "3071125f8bc56a2a5edba94357d0ef19";

// weather.gov quantitative precipitation values are in millimeters.
// Convert to inches for display in this app.
const mmToInches = (value) => (typeof value === "number" ? value / 25.4 : 0);

// Normalize one weather.gov period object into the UI shape used by components.
// Returning a consistent shape makes rendering code simple and predictable.
const normalizePeriod = (period) => {
  if (!period) {
    return null;
  }

  return {
    name: period.name ?? "",
    time: period.startTime ? new Date(period.startTime) : null,
    temperature: period.temperature ?? null,
    shortForecast: period.shortForecast ?? "Clear",
    weatherCode: period.shortForecast ?? "Clear",
    precipitationChance: period.probabilityOfPrecipitation?.value ?? 0,
    precipitationInches: mmToInches(period?.quantitativePrecipitation?.value),
  };
};

// Fetch weather by coordinates and return two arrays:
// - currentPeriods: one or two periods for the top "current" section
// - forecastPeriods: the next four periods for the forecast grid
export async function fetchWeatherByCoords(lat, lon) {
  // Step 1: Convert coordinates into a forecast grid endpoint.
  const pointsResponse = await fetch(
    `https://api.weather.gov/points/${lat},${lon}`,
    {
      headers: WEATHER_HEADERS,
    },
  );

  if (!pointsResponse.ok) {
    throw new Error("Unable to resolve weather.gov forecast grid");
  }

  const pointsData = await pointsResponse.json();
  const { forecast: forecastUrl } = pointsData.properties ?? {};

  if (!forecastUrl) {
    throw new Error("weather.gov points response missing forecast link");
  }

  // Step 2: Fetch the period-based forecast from weather.gov.
  const forecastResponse = await fetch(forecastUrl, {
    headers: WEATHER_HEADERS,
  });

  if (!forecastResponse.ok) {
    throw new Error("Unable to fetch weather.gov forecast");
  }

  const forecastData = await forecastResponse.json();
  const allPeriods = forecastData?.properties?.periods ?? [];

  const firstPeriod = allPeriods[0] ?? null;
  const isDaytime = firstPeriod?.isDaytime ?? true;

  // Daytime response starts with "Today", then "Tonight".
  // Nighttime response starts with "Tonight" only.
  const currentPeriods = isDaytime
    ? [normalizePeriod(allPeriods[0]), normalizePeriod(allPeriods[1])]
    : [normalizePeriod(allPeriods[0])];

  // Forecast cards should show upcoming periods after the current section.
  const forecastStart = isDaytime ? 2 : 1;
  const forecastPeriods = allPeriods
    .slice(forecastStart, forecastStart + 4)
    .map(normalizePeriod)
    .filter(Boolean);

  return {
    currentPeriods: currentPeriods.filter(Boolean),
    forecastPeriods,
  };
}

// Convert user-entered city text into coordinates using OpenWeather geocoding.
// weather.gov forecast endpoints require latitude/longitude instead of city names.
export async function geocodeLocation(locationInput) {
  const geoResponse = await fetch(
    `https://api.openweathermap.org/geo/1.0/direct?q=${locationInput},US&limit=1&appid=${OPENWEATHER_API_KEY}`,
  );

  if (!geoResponse.ok) {
    throw new Error("Unable to geocode location");
  }

  const locationCoordinates = await geoResponse.json();
  if (!Array.isArray(locationCoordinates) || locationCoordinates.length === 0) {
    throw new Error("Location not found");
  }

  return {
    lat: locationCoordinates[0].lat,
    lon: locationCoordinates[0].lon,
  };
}
