import { useEffect, useState } from "react";
import { fetchWeatherApi } from "openmeteo";
import {
  WiCloudy,
  WiDaySunny,
  WiUmbrella,
  WiSnow,
  WiDayWindy,
} from "react-icons/wi";

// Map OpenMeteo weather codes to icon components
const weatherCodeMap = {
  0: WiDaySunny, // Clear sky
  1: WiCloudy, // Mainly clear
  2: WiCloudy, // Partly cloudy
  3: WiCloudy, // Overcast
  45: WiCloudy, // Foggy
  48: WiCloudy, // Depositing rime fog
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
  82: WiUmbrella, // Violent rain showers
  85: WiSnow, // Slight snow showers
  86: WiSnow, // Heavy snow showers
  95: WiDayWindy, // Thunderstorm
  96: WiDayWindy, // Thunderstorm with hail
  99: WiDayWindy, // Thunderstorm with hail
};

function getWeatherIcon(code) {
  const IconComponent = weatherCodeMap[code] || WiDaySunny;
  return <IconComponent size={52} />;
}

function SearchBar({ value, onChange, onSearch }) {
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

function CurrentWeatherDisplay({ data, location }) {
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

function ForecastGrid({ data }) {
  // Guard clause: do not render cards until forecast data exists.
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

  const getWeekdayLabel = (dateValue, fallbackOffsetDays) => {
    // Convert each forecast date to a weekday name like "Wednesday".
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

export default function App() {
  // State: user input and the normalized weather object used by child components.
  const [locationInput, setLocationInput] = useState("");
  const [weatherData, setWeatherData] = useState(null);

  const fetchWeatherByCoords = async (lat, lon) => {
    // Step 2: request forecast data for those coordinates.
    try {
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

      const response = responses[0];
      const utcOffsetSeconds = response.utcOffsetSeconds();
      const current = response.current();
      const daily = response.daily();

      // Step 3: map API data into a simple UI-friendly object shape.
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
      console.log(error);
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationInput(
          //   `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} (current location)`,
          "Current Location",
        );
        void fetchWeatherByCoords(coords.latitude, coords.longitude);
      },
      (error) => {
        console.log(error);
      },
    );
  }, []);

  // Runs when Search is clicked.
  const handleSearch = async () => {
    // Confirm locationInput worked properly
    // console.log("Searching for:", locationInput);
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
    // Confirm location coordinates worked properly
    // console.log(locationInput + " coordinates:", lat, lon);
    await fetchWeatherByCoords(lat, lon);
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
        {/* Props flow: parent App passes prepared data down to child components. */}
        <CurrentWeatherDisplay
          data={weatherData?.current}
          location={locationInput}
        />
        <ForecastGrid data={weatherData?.daily} />
      </div>
    </div>
  );
}
