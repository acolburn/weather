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
const mmToInches = (value) =>
  typeof value === "number" && !Number.isNaN(value) ? value / 25.4 : null;

const parseDurationToMilliseconds = (duration) => {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    duration,
  );

  if (!match) {
    return 0;
  }

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;

  return (
    Number(days) * 24 * 60 * 60 * 1000 +
    Number(hours) * 60 * 60 * 1000 +
    Number(minutes) * 60 * 1000 +
    Number(seconds) * 1000
  );
};

const parseValidTimeRange = (validTime) => {
  const [startTime, duration] = String(validTime ?? "").split("/");
  const start = new Date(startTime);

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  return {
    start,
    end: new Date(start.getTime() + parseDurationToMilliseconds(duration)),
  };
};

const getPeriodQuantitativePrecipitationInches = (period, values) => {
  if (!period?.startTime || !period?.endTime || !Array.isArray(values)) {
    return null;
  }

  const periodStart = new Date(period.startTime).getTime();
  const periodEnd = new Date(period.endTime).getTime();

  if (Number.isNaN(periodStart) || Number.isNaN(periodEnd)) {
    return null;
  }

  const totalMm = values.reduce((sum, entry) => {
    const timeRange = parseValidTimeRange(entry?.validTime);

    if (!timeRange || typeof entry?.value !== "number") {
      return sum;
    }

    const overlaps =
      timeRange.start.getTime() < periodEnd &&
      timeRange.end.getTime() > periodStart;

    return overlaps ? sum + entry.value : sum;
  }, 0);

  return mmToInches(totalMm);
};

const normalizePeriodWithPrecipitation = (period, values) => {
  const normalizedPeriod = normalizePeriod(period);

  if (!normalizedPeriod) {
    return null;
  }

  return {
    ...normalizedPeriod,
    precipitationInches: getPeriodQuantitativePrecipitationInches(
      period,
      values,
    ),
  };
};

// Normalize one weather.gov period object into the UI shape used by components.
// Returning a consistent shape makes rendering code simple and predictable.
const normalizePeriod = (period) => {
  if (!period) {
    return null;
  }

  return {
    name: period.name ?? "",
    time: period.startTime ? new Date(period.startTime) : null,
    endTime: period.endTime ? new Date(period.endTime) : null,
    temperature: period.temperature ?? null,
    shortForecast: period.shortForecast ?? "Clear",
    weatherCode: period.shortForecast ?? "Clear",
    precipitationChance: period.probabilityOfPrecipitation?.value ?? 0,
    precipitationInches: null,
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
  const { forecast: forecastUrl, forecastGridData: gridDataUrl } =
    pointsData.properties ?? {};

  if (!forecastUrl || !gridDataUrl) {
    throw new Error("weather.gov points response missing forecast link");
  }

  // Step 2: Fetch the period-based forecast and grid data from weather.gov.
  const [forecastResponse, gridDataResponse] = await Promise.all([
    fetch(forecastUrl, {
      headers: WEATHER_HEADERS,
    }),
    fetch(gridDataUrl, {
      headers: WEATHER_HEADERS,
    }),
  ]);

  if (!forecastResponse.ok) {
    throw new Error("Unable to fetch weather.gov forecast");
  }

  if (!gridDataResponse.ok) {
    throw new Error("Unable to fetch weather.gov forecast grid data");
  }

  const forecastData = await forecastResponse.json();
  const gridData = await gridDataResponse.json();
  const allPeriods = forecastData?.properties?.periods ?? [];
  const precipitationValues =
    gridData?.properties?.quantitativePrecipitation?.values ?? [];

  const firstPeriod = allPeriods[0] ?? null;
  const isDaytime = firstPeriod?.isDaytime ?? true;

  // Daytime response starts with "Today", then "Tonight".
  // Nighttime response starts with "Tonight" only.
  const currentPeriods = isDaytime
    ? [
        normalizePeriodWithPrecipitation(allPeriods[0], precipitationValues),
        normalizePeriodWithPrecipitation(allPeriods[1], precipitationValues),
      ]
    : [normalizePeriodWithPrecipitation(allPeriods[0], precipitationValues)];

  // Forecast cards should show upcoming periods after the current section.
  const forecastStart = isDaytime ? 2 : 1;
  const forecastPeriods = allPeriods
    .slice(forecastStart, forecastStart + 4)
    .map((period) =>
      normalizePeriodWithPrecipitation(period, precipitationValues),
    )
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
