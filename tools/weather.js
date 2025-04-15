function _interpretWeatherCode(code) {
  const weatherCodes = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };

  return weatherCodes[code] || `Unknown (${code})`;
}

function formatForecast(forecast) {
  return forecast
    .map(
      (day) =>
        `${day.date}: ${day.weather} with a high of ${day.max_temp} and a low of ${day.min_temp}. Precipitation: ${day.precipitation}`
    )
    .join("\n");
}

async function getWeather(args) {
  const days = 16;
  const { latitude, longitude } = JSON.parse(args);
  const result = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&hourly=temperature_2m,precipitation,weather_code`
  );
  const data = await result.json();
  const forecast = [];

  for (let i = 0; i < Math.min(days, data.daily.time.length); i++) {
    forecast.push({
      date: data.daily.time[i],
      max_temp: `${data.daily.temperature_2m_max[i]} ${data.daily_units.temperature_2m_max}`,
      min_temp: `${data.daily.temperature_2m_min[i]} ${data.daily_units.temperature_2m_min}`,
      precipitation: `${data.daily.precipitation_sum[i]} ${data.daily_units.precipitation_sum}`,
      weather: _interpretWeatherCode(data.daily.weather_code[i]),
    });
  }

  return forecast;
}

async function getCoordinates(args) {
  const { location } = JSON.parse(args);
  console.log({ location });
  const result = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${location}&count=1&language=en&format=json`
  );
  const response = await result.json();
  console.log({ latitude: response[0]?.latitude, longitude: response[0]?.longitude });
  return { latitude: response[0]?.latitude, longitude: response[0]?.longitude };
}

// Tool definition for subtract function
const getWeatherTool = {
  type: "function",
  function: {
    name: "getWeather",
    description: "Get Weather using latitude and Longitude",
    parameters: {
      type: "object",
      required: ["latitude", "longitude"],
      properties: {
        latitude: { type: "number", description: "The latitude of location" },
        longitude: { type: "number", description: "The longitude of location" },
      },
    },
  },
};

const getCoordinatesTool = {
  type: "function",
  function: {
    name: "getCoordinates",
    description: "Get coordinates of location",
    parameters: {
      type: "object",
      required: ["location"],
      properties: {
        location: { type: "string", description: "The location from query" },
      },
    },
  },
};

const availableFunctions = {
  getWeather: getWeather,
  getCoordinates: getCoordinates,
};

module.exports = { availableFunctions, formatForecast, getCoordinatesTool, getWeatherTool };
