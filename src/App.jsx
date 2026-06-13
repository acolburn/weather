import { useEffect, useRef, useState } from "react";
import Combobox from "react-widgets/Combobox";
import "react-widgets/styles.css";
import {
  WiCloudy,
  WiDaySunny,
  WiUmbrella,
  WiSnow,
  WiFog,
  WiDayCloudy,
  WiDayThunderstorm,
  WiHail,
} from "react-icons/wi";
import {
  fetchWeatherByCoords as fetchWeatherByCoordsFromApi,
  geocodeLocation,
} from "./services/weatherGov";

/*
  MAINTAINER GUIDE (React Hooks Edition)
  --------------------------------------
  What this file does:
  1) Own all weather-related state and async loading logic in App.
  2) Keep child components mostly presentational (render-only).

  Why this structure helps beginners:
  - One place (App) controls state transitions.
  - UI components receive props and stay predictable.
  - Search and startup flows reuse shared helpers to avoid duplicated logic.

  Hook usage at a glance:
  - useState: values that should trigger UI re-renders when they change.
  - useRef: mutable values that must persist between renders without re-rendering.
  - useEffect: startup side effect (initial geolocation weather load).
*/

const nwsKeywordIconMap = [
  { test: /thunder|tstorm|storm/i, icon: WiDayThunderstorm },
  { test: /hail/i, icon: WiHail },
  { test: /snow|sleet|blizzard|flurr/i, icon: WiSnow },
  { test: /rain|shower|drizzle/i, icon: WiUmbrella },
  { test: /fog|haze|smoke|mist/i, icon: WiFog },
  { test: /overcast|cloudy/i, icon: WiCloudy },
  { test: /partly|mostly cloudy/i, icon: WiDayCloudy },
  { test: /clear|sunny|fair/i, icon: WiDaySunny },
];

const presetLocations = [
  "Long Beach, CA",
  "Cypress, CA",
  "Costa Mesa, CA",
  "Atascadero, CA",
  "Brinnon, WA",
  "Granite Bay, CA",
  "White Plains, NY",
];

const wholeNumber = (value) =>
  typeof value === "number" && !Number.isNaN(value) ? Math.floor(value) : "--";

const oneDecimalPlace = (value) =>
  typeof value === "number" && !Number.isNaN(value) ? value.toFixed(1) : "--";

// Map weather.gov forecast text to an icon component.
function getWeatherIcon(forecastText) {
  const keywordMatch = nwsKeywordIconMap.find(({ test }) =>
    test.test(String(forecastText ?? "")),
  );
  const IconComponent = keywordMatch?.icon || WiDaySunny;
  return <IconComponent size={52} />;
}

// SearchBar is controlled by App state (`value` + `onChange`).
function SearchBar({ value, onChange, onSearch }) {
  // Refs store mutable values between renders without causing re-renders.
  // latestInputValueRef tracks the freshest typed text (even before state settles).
  // comboboxInputRef gives direct access to the underlying input element.
  const latestInputValueRef = useRef(value ?? "");
  const comboboxInputRef = useRef(null);

  // Local UI state for controlling whether the combobox popup is open.
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);

  // Keep the ref in sync whenever parent-controlled value changes.
  useEffect(() => {
    latestInputValueRef.current = value ?? "";
  }, [value]);

  const hasPresetLocation = presetLocations.includes(value);

  // Reads what user actually typed at submit time.
  // This avoids race conditions where state may lag one keystroke.
  const readSubmittedLocation = () => {
    const inputElement = comboboxInputRef.current;
    if (inputElement && typeof inputElement.value === "string") {
      return inputElement.value.trim();
    }

    return latestInputValueRef.current.trim();
  };

  const closeCombobox = () => {
    setIsComboboxOpen(false);
    comboboxInputRef.current?.blur();
  };

  // Shared submit path used by button click, Enter key, and dropdown selection.
  const submitSearch = (rawLocation) => {
    onSearch(rawLocation);
    closeCombobox();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submitSearch(readSubmittedLocation());
  };

  const handleFormKeyDownCapture = (event) => {
    if (event.key !== "Enter") {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    event.preventDefault();
    submitSearch(readSubmittedLocation());
  };

  const handleComboboxChange = (nextValue) => {
    latestInputValueRef.current = String(nextValue ?? "");
    onChange(nextValue);
  };

  const comboboxLocations = [
    ...presetLocations,
    ...(value === "Current Location" && !hasPresetLocation
      ? ["Current Location"]
      : []),
  ];

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDownCapture={handleFormKeyDownCapture}
      className="flex flex-col sm:flex-row gap-2 mb-8 sm:items-center"
    >
      <Combobox
        open={isComboboxOpen}
        onToggle={(nextOpen) => {
          setIsComboboxOpen(Boolean(nextOpen));
        }}
        onFocus={() => {
          setIsComboboxOpen(true);
        }}
        value={value}
        onChange={handleComboboxChange}
        onSelect={(item) => {
          latestInputValueRef.current = String(item ?? "");
          onChange(item);
          submitSearch(item);
        }}
        data={comboboxLocations}
        placeholder="Select location ..."
        filter={false}
        containerClassName="flex-1 h-12"
        inputProps={{
          className:
            "w-full h-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base",
          "aria-label": "Select or type location",
          ref: comboboxInputRef,
          onInput: (event) => {
            latestInputValueRef.current = event.currentTarget.value;
          },
        }}
      />

      <button
        type="submit"
        className="px-6 h-12 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium w-full sm:w-auto"
      >
        Search
      </button>
    </form>
  );
}

// Reusable weather card for current and forecast sections.
// This component is intentionally stateless: all data arrives through props.
function PeriodCard({ period, variant }) {
  const isCurrent = variant === "current";

  return (
    <div
      className={
        isCurrent
          ? ""
          : "bg-white border border-blue-600 rounded-lg p-4 text-center shadow-xl"
      }
    >
      <h3
        className={
          isCurrent
            ? "text-blue-100 mb-4 text-sm sm:text-base font-semibold uppercase tracking-wide"
            : "font-semibold text-gray-800 mb-3 text-base"
        }
      >
        {period.name || "--"}
      </h3>

      <p
        className={
          isCurrent
            ? "text-xl sm:text-2xl mb-4"
            : "text-sm mb-3 flex justify-center text-gray-600"
        }
      >
        {getWeatherIcon(period.weatherCode)}
      </p>

      <div className={isCurrent ? "" : "mb-3"}>
        {!isCurrent && <p className="text-xs text-gray-500">Temperature</p>}
        <p
          className={
            isCurrent
              ? "text-5xl sm:text-6xl font-bold mb-2"
              : "text-lg sm:text-xl font-bold text-gray-800"
          }
        >
          {wholeNumber(period.temperature)}°
        </p>
      </div>

      <p
        className={
          isCurrent
            ? "text-base sm:text-lg mb-2"
            : "text-sm sm:text-base text-gray-700 mb-2"
        }
      >
        <span className="font-semibold">Conditions:</span>{" "}
        {period.shortForecast ?? "--"}
      </p>

      <p
        className={
          isCurrent
            ? "text-base sm:text-lg"
            : "text-base sm:text-lg font-semibold text-blue-600"
        }
      >
        <span className="font-semibold">Rain Chance:</span>{" "}
        {wholeNumber(period.precipitationChance)}%
        {!isCurrent &&
          ` (~${oneDecimalPlace(period.precipitationInches)} inches)`}
      </p>
    </div>
  );
}

// Current weather display (presentational only).
// If periods is empty, render a friendly placeholder state.
function CurrentWeatherDisplay({ periods, location }) {
  if (!periods || periods.length === 0) {
    return (
      <div className="bg-linear-to-br from-blue-400 to-blue-600 rounded-lg p-6 sm:p-8 text-white mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">
          {location || "Location"}
        </h2>
        <p className="text-blue-100 mb-6 text-sm sm:text-base">Now</p>
        <div className="text-center text-blue-100">
          Search for a location to see weather data.
        </div>
      </div>
    );
  }

  const hasTwoPanels = periods.length > 1;

  return (
    <div className="bg-linear-to-br from-blue-400 to-blue-600 rounded-lg p-6 sm:p-8 text-white mb-8">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6">{location}</h2>
      <div
        className={`grid grid-cols-1 gap-6 ${
          hasTwoPanels ? "sm:grid-cols-2 sm:divide-x sm:divide-blue-300" : ""
        }`}
      >
        {periods.map((period, index) => (
          <div
            key={`${period.name}-${period.time ? period.time.toString() : index}`}
            className={hasTwoPanels && index > 0 ? "sm:pl-6" : ""}
          >
            <PeriodCard period={period} variant="current" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Forecast grid for upcoming periods.
// Returns null when no forecast exists so parent layout remains clean.
function ForecastGrid({ periods }) {
  if (!periods || periods.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
        Next 2 Days
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {periods.map((period, index) => (
          <PeriodCard
            key={`${period.name}-${period.time ? period.time.toString() : index}`}
            period={period}
            variant="forecast"
          />
        ))}
      </div>
    </div>
  );
}

// App container: fetches weather data and passes it to presentational components.
export default function App() {
  /*
    State model:
    - locationInput: current text shown in the search box.
    - locationLabel: location currently displayed in weather header.
    - weatherData: normalized API result for current + forecast sections.
    - deviceCoords: cached geolocation for fast "Current Location" reloads.
    - isLoadingWeather/statusMessage: UI feedback for async operations.
  */
  const [locationInput, setLocationInput] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [deviceCoords, setDeviceCoords] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  // Prevent duplicate startup requests (useful under React StrictMode dev behavior).
  const hasAttemptedStartupLoad = useRef(false);

  // Called after any successful weather request to sync display label and clear search box.
  const applySuccessfulLocation = (label) => {
    setLocationLabel(label);
    setLocationInput("");
  };

  // Converts low-level errors into user-friendly text.
  const getFriendlyErrorMessage = (error, isStartupLoad = false) => {
    if (error?.code === 1) {
      return isStartupLoad
        ? "Location permission denied. Search by city to see weather."
        : "Location permission denied.";
    }

    if (error?.code === 2) {
      return isStartupLoad
        ? "Could not determine your location. Search by city to see weather."
        : "Could not determine your location.";
    }

    if (error?.code === 3) {
      return isStartupLoad
        ? "Location lookup timed out. Search by city to see weather."
        : "Location lookup timed out.";
    }

    if (error?.message === "Location not found") {
      return "Location not found. Try a City, ST format.";
    }

    return "Unable to load weather right now. Please try again.";
  };

  // Promise wrapper around callback-based geolocation for async/await usage.
  const getDeviceCoords = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          resolve({ lat: coords.latitude, lon: coords.longitude });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        },
      );
    });

  // Shared network loader for weather.gov forecast data by coordinates.
  const loadWeatherByCoords = async (lat, lon) => {
    const data = await fetchWeatherByCoordsFromApi(lat, lon);
    setWeatherData(data);
  };

  // Uses cached device coordinates when possible, otherwise asks browser again.
  const searchCurrentLocation = async () => {
    let coordsToUse = deviceCoords;

    if (!coordsToUse) {
      coordsToUse = await getDeviceCoords();
      setDeviceCoords(coordsToUse);
    }

    await loadWeatherByCoords(coordsToUse.lat, coordsToUse.lon);
    applySuccessfulLocation("Current Location");
  };

  // Geocodes typed city/state text, then loads weather by resulting coordinates.
  const searchTypedLocation = async (normalizedLocation) => {
    if (!normalizedLocation) {
      setStatusMessage("Enter a location to search.");
      return;
    }

    setLocationInput(normalizedLocation);
    const { lat, lon } = await geocodeLocation(normalizedLocation);
    await loadWeatherByCoords(lat, lon);
    applySuccessfulLocation(normalizedLocation);
  };

  // Startup effect: try loading local weather once when component mounts.
  useEffect(() => {
    if (hasAttemptedStartupLoad.current) {
      return;
    }

    hasAttemptedStartupLoad.current = true;

    // Best-effort startup load; manual search remains available on failure.
    const runStartupWeatherLoad = async () => {
      setIsLoadingWeather(true);

      try {
        setStatusMessage("");
        const latestCoords = await getDeviceCoords();
        setDeviceCoords(latestCoords);
        await loadWeatherByCoords(latestCoords.lat, latestCoords.lon);
        applySuccessfulLocation("Current Location");
      } catch (error) {
        setStatusMessage(getFriendlyErrorMessage(error, true));
        console.log(error);
      } finally {
        setIsLoadingWeather(false);
      }
    };

    // Fire and forget inside effect. Internal try/catch handles failures.
    void runStartupWeatherLoad();
  }, []);

  // Main search entrypoint used by SearchBar.
  // 1) Normalize input
  // 2) Route to current-location flow or typed-location flow
  // 3) Manage loading + user-facing error message
  const handleSearch = async (
    location = locationInput,
    isStartupLoad = false,
  ) => {
    setIsLoadingWeather(true);

    try {
      setStatusMessage("");

      const normalizedLocation = String(location ?? "").trim();

      if (normalizedLocation === "Current Location") {
        await searchCurrentLocation();
        return;
      }

      await searchTypedLocation(normalizedLocation);
    } catch (error) {
      setStatusMessage(getFriendlyErrorMessage(error, isStartupLoad));
      console.log(error);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-6 sm:mb-8">
          Al's Weather App
        </h1>

        <SearchBar
          value={locationInput}
          onChange={setLocationInput}
          onSearch={handleSearch}
        />

        {isLoadingWeather && (
          <p className="text-sm text-gray-600 mb-4">Loading weather...</p>
        )}

        {!isLoadingWeather && statusMessage && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            {statusMessage}
          </p>
        )}

        <CurrentWeatherDisplay
          periods={weatherData?.currentPeriods}
          location={locationLabel}
        />

        <ForecastGrid periods={weatherData?.forecastPeriods} />
      </div>
    </div>
  );
}
