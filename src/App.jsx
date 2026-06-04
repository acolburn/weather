import { useEffect, useState } from "react";
import { fetchWeatherApi } from "openmeteo";
import {
  WiCloudy,
  WiDaySunny,
  WiUmbrella,
  WiSnow,
  WiFog,
  WiStormShowers,
  WiCloud,
  WiDayCloudy,
  WiDayThunderstorm,
  WiHail,
} from "react-icons/wi";

// HOW IT WORKS:
// This app has two responsibilities:
// 1) Get weather data (from geolocation on startup or from a searched city name)
// 2) Render that data with small, reusable UI components
//
// WHY this structure:
// Keeping data-fetching logic in the App component and UI display logic in child
// components makes the code easier to reason about and easier to refactor later.

// Map OpenMeteo weather codes to icon components
const weatherCodeMap = {
  0: WiDaySunny, // Clear sky
  1: WiDayCloudy, // Mainly clear
  2: WiCloud, // Partly cloudy
  3: WiCloudy, // Overcast
  45: WiFog, // Foggy
  48: WiFog, // Depositing rime fog
  51: WiUmbrella, // Light drizzle
  53: WiUmbrella, // Moderate drizzle
  55: WiUmbrella, // Dense drizzle
  61: WiUmbrella, // Slight rain
  63: WiUmbrella, // Moderate rain
  65: WiUmbrella, // Heavy rain
  71: WiSnow, // Slight snow
  73: WiSnow, // Moderate snow
  75: WiSnow, // Heavy snow
  77: WiSnow, // Snow grains
  80: WiUmbrella, // Slight rain showers
  81: WiUmbrella, // Moderate rain showers
  82: WiStormShowers, // Violent rain showers
  85: WiSnow, // Slight snow showers
  86: WiSnow, // Heavy snow showers
  95: WiDayThunderstorm, // Thunderstorm
  96: WiDayThunderstorm, // Thunderstorm with hail
  99: WiHail, // Thunderstorm with hail
};

// HOW IT WORKS:
// Open-Meteo returns numeric weather codes. UI should not display raw numbers when
// a visual icon is better for quick reading.
//
// WHY this helper exists:
// It centralizes "code -> icon" mapping in one place. If you change icon choices,
// you only change this function/map, not every component that displays weather.
function getWeatherIcon(code) {
  const IconComponent = weatherCodeMap[code] || WiDaySunny;
  return <IconComponent size={52} />;
}

// HOW IT WORKS:
// SearchBar is a controlled input. Its value is owned by App state and passed in
// through props. User typing calls onChange, which updates App state.
//
// WHY controlled input:
// A controlled input keeps the source of truth in React state, so the UI and state
// never drift apart. This is especially important when multiple components depend
// on the same value (search box text + heading label).
function SearchBar({ value, onChange, onSearch }) {
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

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-2 mb-8"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        enterKeyHint="search"
        placeholder="Enter city name"
        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
      />

      <button
        type="submit"
        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium w-full sm:w-auto"
      >
        Search
      </button>
    </form>
  );
}

// HOW IT WORKS:
// This component renders the "current" weather card.
// It receives data through props and does not fetch anything itself.
//
// WHY prop-driven rendering:
// Keeping this component "presentational" makes it easier to test and reuse.
// App decides what data to provide; this component only decides how it looks.
function CurrentWeatherDisplay({ data, location }) {
  // HOW IT WORKS:
  // Guard clause for first render (or failed fetch): if no data, show helpful placeholder.
  //
  // WHY this guard is needed:
  // React renders immediately before async requests finish. Without this guard,
  // reading fields like data.temperature_2m would crash when data is null/undefined.
  if (!data) {
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

  return (
    <div className="bg-linear-to-br from-blue-400 to-blue-600 rounded-lg p-6 sm:p-8 text-white mb-8">
      <h2 className="text-2xl sm:text-3xl font-bold mb-2">{location}</h2>
      <p className="text-blue-100 mb-6 text-sm sm:text-base">Now</p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <p className="text-5xl sm:text-6xl font-bold mb-2">
            {Math.floor(data.temperature_2m)}°
          </p>
          <p className="text-xl sm:text-2xl mb-2">
            {getWeatherIcon(data.weather_code)}
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-base sm:text-lg mb-4">
            <span className="font-semibold">Cloud Cover:</span>{" "}
            {data.cloud_cover ?? "--"}%
          </p>
          {/* <p className="text-base sm:text-lg mb-4">
            <span className="font-semibold">Low:</span> {data.low ?? "--"}°
          </p> */}
          <p className="text-base sm:text-lg">
            <span className="font-semibold">Precipitation Chance:</span>{" "}
            {data.precipitation ?? "--"}%
          </p>
        </div>
      </div>
    </div>
  );
}

// HOW IT WORKS:
// ForecastCard displays one day of forecast. ForecastGrid passes values into this
// component for each day.
//
// WHY isolate one card:
// Repeating markup manually is error-prone. A reusable card component reduces
// duplication and makes future style/content updates faster.
function ForecastCard({ dayLabel, temp, rain, rainChance, weatherCode }) {
  return (
    <div className="bg-white border border-blue-600 rounded-lg p-4 text-center shadow-xl">
      <h3 className="font-semibold text-gray-800 mb-3 text-base">{dayLabel}</h3>
      <p className="text-gray-600 mb-3 text-sm flex justify-center">
        {getWeatherIcon(weatherCode)}
      </p>

      <div className="mb-3">
        <p className="text-xs text-gray-500">Temperature</p>
        <p className="text-lg sm:text-xl font-bold text-gray-800">
          {Math.floor(temp)}°
        </p>
      </div>

      <div>
        <p className="text-xs text-gray-500">Rain Chance</p>
        <p className="text-base sm:text-lg font-semibold text-blue-600">
          {rainChance}% (~{Math.round(rain / 100) * 100} inches)
        </p>
      </div>
    </div>
  );
}

// HOW IT WORKS:
// ForecastGrid receives a normalized "daily" object and renders 3 ForecastCard
// components (tomorrow + two following days).
//
// WHY this component owns list rendering:
// It keeps "which days are shown" and "how labels are derived" in one place,
// so ForecastCard can stay simple and focused on display only.
function ForecastGrid({ data }) {
  // Guard clause: do not render cards until forecast data exists.
  // WHY this guard matters:
  // During initial render, data is not ready yet. This prevents undefined access errors.
  if (
    !data ||
    !data.time ||
    !data.temperature_2m_max ||
    !data.precipitation_sum ||
    !data.precipitation_probability_max ||
    !data.weather_code
  ) {
    return null;
  }

  // HOW IT WORKS:
  // Converts Date values into weekday names.
  // If dateValue is invalid/missing, fallbackOffsetDays keeps labels usable.
  //
  // WHY include UTC in formatting:
  // Forecast dates often arrive around midnight boundaries. UTC formatting avoids
  // local timezone shifts that can display the previous day name.
  const getWeekdayLabel = (dateValue, fallbackOffsetDays) => {
    const date = dateValue instanceof Date ? dateValue : null;
    if (date && !Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "UTC",
      });
    }

    const fallback = new Date();
    fallback.setDate(fallback.getDate() + fallbackOffsetDays);
    return fallback.toLocaleDateString("en-US", { weekday: "long" });
  };

  return (
    <div>
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
        Next Few Days
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <ForecastCard
          dayLabel={getWeekdayLabel(data.time[1], 1)}
          temp={data.temperature_2m_max[1]}
          rain={data.precipitation_sum[1]}
          rainChance={data.precipitation_probability_max[1]}
          weatherCode={data.weather_code[1]}
        />
        <ForecastCard
          dayLabel={getWeekdayLabel(data.time[2], 2)}
          temp={data.temperature_2m_max[2]}
          rain={data.precipitation_sum[2]}
          rainChance={data.precipitation_probability_max[2]}
          weatherCode={data.weather_code[2]}
        />
        <ForecastCard
          dayLabel={getWeekdayLabel(data.time[3], 3)}
          temp={data.temperature_2m_max[3]}
          rain={data.precipitation_sum[3]}
          rainChance={data.precipitation_probability_max[3]}
          weatherCode={data.weather_code[3]}
        />
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
  // State: user input and the normalized weather object used by child components.
  const [locationInput, setLocationInput] = useState("");
  const [weatherData, setWeatherData] = useState(null);

  // HOW IT WORKS:
  // Shared fetch helper that accepts coordinates, calls Open-Meteo, normalizes
  // response shape, then saves into weatherData state.
  //
  // WHY a shared helper:
  // Both startup geolocation and manual city search need this same step.
  // Sharing it avoids duplicate code and keeps behavior consistent.
  const fetchWeatherByCoords = async (lat, lon) => {
    // Step 2: request forecast data for those coordinates.
    try {
      // HOW IT WORKS:
      // params defines exactly which weather fields to request and how to format units.
      //
      // WHY request only needed fields:
      // Smaller responses are faster and simpler to map to UI.
      const params = {
        latitude: lat,
        longitude: lon,
        daily: [
          "weather_code",
          "temperature_2m_max",
          "precipitation_sum",
          "precipitation_hours",
          "precipitation_probability_max",
        ],
        current: [
          "temperature_2m",
          "precipitation",
          "cloud_cover",
          "weather_code",
        ],
        timezone: "America/Los_Angeles",
        forecast_days: 4,
        wind_speed_unit: "mph",
        temperature_unit: "fahrenheit",
        precipitation_unit: "inch",
      };
      const url = "https://api.open-meteo.com/v1/forecast";
      const responses = await fetchWeatherApi(url, params);

      // HOW IT WORKS:
      // SDK returns an array; this app uses first response entry.
      const response = responses[0];
      const utcOffsetSeconds = response.utcOffsetSeconds();
      const current = response.current();
      const daily = response.daily();

      // Step 3: map API data into a simple UI-friendly object shape.
      // WHY normalize data shape:
      // UI components should not depend on low-level SDK response methods.
      // A plain object is easier to inspect, debug, and pass via props.
      const forecastWeatherData = {
        current: {
          time: new Date(Number(current.time()) * 1000),
          temperature_2m: current.variables(0).value(),
          precipitation: current.variables(1).value(),
          cloud_cover: current.variables(2).value(),
          weather_code: current.variables(3).value(),
        },
        daily: {
          time: Array.from(
            {
              length:
                (Number(daily.timeEnd()) - Number(daily.time())) /
                daily.interval(),
            },
            (_, i) =>
              new Date(
                (Number(daily.time()) +
                  i * daily.interval() +
                  utcOffsetSeconds) *
                  1000,
              ),
          ),
          weather_code: daily.variables(0).valuesArray(),
          temperature_2m_max: daily.variables(1).valuesArray(),
          precipitation_sum: daily.variables(2).valuesArray(),
          precipitation_hours: daily.variables(3).valuesArray(),
          precipitation_probability_max: daily.variables(4).valuesArray(),
        },
      };

      // Saving state triggers a re-render so UI components receive fresh props.
      setWeatherData(forecastWeatherData);
    } catch (error) {
      // HOW IT WORKS:
      // Catch prevents unhandled promise errors from crashing this flow.
      // WHY keep this for beginners:
      // Errors are inevitable with network calls; capturing them gives you one place
      // to add user-facing error messages later.
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
        // HOW IT WORKS:
        // The same location label appears in input and current-weather heading because
        // both are driven by locationInput state.
        setLocationInput("Current Location");

        // WHY void keyword:
        // fetchWeatherByCoords returns a promise. We intentionally fire-and-forget
        // here and avoid awaiting inside this callback.
        void fetchWeatherByCoords(coords.latitude, coords.longitude);
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

  // Runs when Search is clicked.
  // HOW IT WORKS:
  // Converts typed city -> coordinates -> weather data.
  //
  // WHY two-step process:
  // Open-Meteo endpoint expects coordinates, so city text must be geocoded first.
  const handleSearch = async () => {
    // Step 1: geocode the city name into latitude/longitude.
    let lat, lon; // declare here so usable outside try/catch
    try {
      const geoResponse = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${locationInput},US&limit=1&appid=3071125f8bc56a2a5edba94357d0ef19`,
      );
      const locationCoordinates = await geoResponse.json();
      if (locationCoordinates.length === 0) {
        throw new Error("Location not found");
      }

      ({ lat, lon } = locationCoordinates[0]);
    } catch (error) {
      console.log(error);
    }

    // WHY this call is separate:
    // Search flow reuses the same coordinate-based fetch helper used by geolocation.
    await fetchWeatherByCoords(lat, lon);
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
          data={weatherData?.current}
          location={locationInput}
        />

        {/* HOW IT WORKS:
            weatherData?.daily passes normalized daily arrays for 3 forecast cards. */}
        <ForecastGrid data={weatherData?.daily} />
      </div>
    </div>
  );
}
