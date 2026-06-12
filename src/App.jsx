import { useEffect, useState } from "react";
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

// HOW IT WORKS:
// This app has two responsibilities:
// 1) Get weather data (from geolocation on startup or from a searched city name)
// 2) Render that data with small, reusable UI components
//
// WHY this structure:
// Keeping data-fetching logic in the App component and UI display logic in child
// components makes the code easier to reason about and easier to refactor later.

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

const wholeNumber = (value) =>
  typeof value === "number" && !Number.isNaN(value) ? Math.floor(value) : "--";

// HOW IT WORKS:
// weather.gov gives text phrases (for example: "Partly Cloudy") rather than
// numeric weather codes.
//
// WHY this helper exists:
// It centralizes text->icon mapping so component markup stays simple.
// If you want different icon choices later, change this one function.
function getWeatherIcon(forecastText) {
  const keywordMatch = nwsKeywordIconMap.find(({ test }) =>
    test.test(String(forecastText ?? "")),
  );
  const IconComponent = keywordMatch?.icon || WiDaySunny;
  return <IconComponent size={52} />;
}

// HOW IT WORKS:
// SearchBar is a controlled dropdown. Its value is owned by App state and passed
// in through props. User selection calls onChange, which updates App state.
//
// WHY controlled dropdown:
// A controlled select keeps the source of truth in React state, so the UI and
// state never drift apart. This is especially important when multiple components
// depend on the same value (location selection + heading label).
function SearchBar({ value, onChange, onSearch }) {
  const locations = [
    "Long Beach, CA",
    "Cypress, CA",
    "Costa Mesa, CA",
    "Atascadero, CA",
    "Brinnon, WA",
    "Granite Bay, CA",
    "White Plains, NY",
  ];

  const hasPresetLocation = locations.includes(value);

  // HOW IT WORKS:
  // Submitting the form triggers this handler on desktop and mobile keyboards.
  // event.preventDefault() stops full page reload, keeping this a single-page app.
  // onSearch() delegates the actual search logic to App.
  //
  // WHY submit event instead of keydown only:
  // Mobile keyboards do not always emit the same keydown behavior as desktop.
  // Form submit is the most reliable cross-device trigger for "Enter/Search".
  const handleSubmit = (event) => {
    event.preventDefault();
    onSearch();
  };

  const comboboxLocations = [
    ...locations,
    ...(value === "Current Location" && !hasPresetLocation
      ? ["Current Location"]
      : []),
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-2 mb-8 sm:items-center"
    >
      <Combobox
        value={value}
        onChange={onChange}
        onSelect={(item) => {
          onChange(item);
          onSearch(item);
        }}
        data={comboboxLocations}
        placeholder="Select location ..."
        filter="contains"
        containerClassName="flex-1 h-12"
        inputProps={{
          className:
            "w-full h-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base",
          "aria-label": "Select or type location",
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

// HOW IT WORKS:
// PeriodCard renders one forecast period object. The same component is reused in
// both the current section and the forecast grid.
//
// Props:
// - period: normalized period object from services/weatherGov.js
// - variant: "current" or "forecast" (controls layout/styling only)
//
// WHY this component exists:
// One reusable card removes duplicated UI code and keeps formatting consistent.
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
        {!isCurrent && ` (~${wholeNumber(period.precipitationInches)} inches)`}
      </p>
    </div>
  );
}

// HOW IT WORKS:
// This component renders the "current" weather card.
// It receives data through props and does not fetch anything itself.
//
// WHY prop-driven rendering:
// Keeping this component "presentational" makes it easier to test and reuse.
// App decides what data to provide; this component only decides how it looks.
function CurrentWeatherDisplay({ periods, location }) {
  // periods is an array:
  // - Daytime: [todayPeriod, tonightPeriod]
  // - Nighttime: [tonightPeriod]
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

// HOW IT WORKS:
// ForecastGrid receives an array of normalized period objects and renders one
// card per period.
//
// WHY this component exists:
// It keeps list rendering concerns in one place so the parent App component stays
// focused on state + data flow.
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

// HOW IT WORKS (React Hooks Deep Dive):
// This is the stateful container component. It owns data fetching and state.
// Child components are mostly presentational and receive props.
//
// useState explanation:
// - useState creates state that survives re-renders.
// - [locationInput, setLocationInput] stores current text in the search input.
// - [weatherData, setWeatherData] stores fetched + normalized weather data.
// - Calling a setter schedules a re-render with the new value.
//
// WHY useState here:
// - locationInput changes with user typing and must drive both input + heading text.
// - weatherData changes after async fetch and must update multiple UI sections
//   (current conditions + forecast cards) in one consistent render.
//
// useEffect explanation:
// - useEffect runs side effects after React renders.
// - Side effects are operations outside pure rendering: API calls, geolocation,
//   subscriptions, timers, manual DOM work, etc.
// - This app uses useEffect once on mount to get device location automatically.
//
// WHY useEffect for geolocation:
// - Geolocation is async and side-effectful (permission prompt + browser API call).
// - It should not run during render itself.
// - The empty dependency array [] means "run once after first render".
//   This prevents repeated prompts/fetches on every re-render.
export default function App() {
  // locationInput: controlled text input value
  // weatherData: normalized weather data from weatherGov service helpers
  // deviceCoords: latest successful geolocation coordinates for this session
  const [locationInput, setLocationInput] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [deviceCoords, setDeviceCoords] = useState(null);

  // HOW IT WORKS:
  // Wrap the browser callback-style geolocation API in a Promise so we can use
  // async/await in handleSearch.
  //
  // WHY this helper exists:
  // It keeps geolocation details in one place and makes the search logic easier
  // to read for beginners.
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
      );
    });

  // Shared loader used by startup geolocation and manual city search.
  const loadWeatherByCoords = async (lat, lon) => {
    try {
      const data = await fetchWeatherByCoordsFromApi(lat, lon);
      setWeatherData(data);
    } catch (error) {
      console.log(error);
    }
  };

  // HOW IT WORKS:
  // On first app load, attempt geolocation. If successful, set a friendly label
  // and fetch weather immediately using those coordinates.
  //
  // WHY this improves UX:
  // Users see local weather instantly without typing.
  // If permission is denied, app still works with manual search.
  useEffect(() => {
    if (!navigator.geolocation) {
      // WHY early return:
      // Some environments may not support geolocation (older browsers, restricted contexts).
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latestCoords = { lat: coords.latitude, lon: coords.longitude };

        // Save geolocation coordinates so future "Current Location" searches
        // can reuse them without geocoding a text string.
        setDeviceCoords(latestCoords);

        // HOW IT WORKS:
        // The same location label appears in input and current-weather heading because
        // both are driven by locationInput state.
        setLocationInput("Current Location");

        // WHY void keyword:
        // loadWeatherByCoords returns a promise. We intentionally fire-and-forget
        // here and avoid awaiting inside this callback.
        void loadWeatherByCoords(latestCoords.lat, latestCoords.lon);
      },
      (error) => {
        // WHY log here:
        // Denied permission should not break rendering; it should quietly fall back
        // to manual search.
        console.log(error);
      },
    );
    // Empty dependency array means this effect runs once on mount.
  }, []);

  // Search flow: city text -> coordinates -> weather.
  const handleSearch = async (location = locationInput) => {
    try {
      // HOW IT WORKS:
      // "Current Location" should use geolocation coordinates, not city geocoding.
      // First try cached session coords. If not available, request coordinates now.
      if (location === "Current Location") {
        let coordsToUse = deviceCoords;

        if (!coordsToUse) {
          coordsToUse = await getDeviceCoords();
          setDeviceCoords(coordsToUse);
        }

        await loadWeatherByCoords(coordsToUse.lat, coordsToUse.lon);
        return;
      }

      const { lat, lon } = await geocodeLocation(location);
      await loadWeatherByCoords(lat, lon);
    } catch (error) {
      console.log(error);
    }
  };

  // HOW IT WORKS:
  // App composes the page and passes state + handlers down through props.
  //
  // WHY this composition style:
  // It keeps data ownership centralized while letting child components stay focused
  // on rendering specific pieces of UI.
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

        {/* HOW IT WORKS:
            weatherData?.current uses optional chaining so first render is safe
            before async data arrives. */}
        <CurrentWeatherDisplay
          periods={weatherData?.currentPeriods}
          location={locationInput}
        />

        {/* HOW IT WORKS:
            weatherData?.forecastPeriods passes an array of normalized periods. */}
        <ForecastGrid periods={weatherData?.forecastPeriods} />
      </div>
    </div>
  );
}
