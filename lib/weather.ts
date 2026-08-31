export type WeatherSnapshot = {
  tempC: number;
  description: string;
  icon: string;
};

// WMO weather codes as returned by Open-Meteo's current_weather.weathercode.
const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: "Sunny", icon: "☀️" },
  1: { description: "Mostly Sunny", icon: "🌤️" },
  2: { description: "Partly Cloudy", icon: "⛅" },
  3: { description: "Cloudy", icon: "☁️" },
  45: { description: "Foggy", icon: "🌫️" },
  48: { description: "Foggy", icon: "🌫️" },
  51: { description: "Drizzle", icon: "🌦️" },
  53: { description: "Drizzle", icon: "🌦️" },
  55: { description: "Drizzle", icon: "🌦️" },
  56: { description: "Freezing Drizzle", icon: "🌧️" },
  57: { description: "Freezing Drizzle", icon: "🌧️" },
  61: { description: "Rain", icon: "🌧️" },
  63: { description: "Rain", icon: "🌧️" },
  65: { description: "Heavy Rain", icon: "🌧️" },
  66: { description: "Freezing Rain", icon: "🌧️" },
  67: { description: "Freezing Rain", icon: "🌧️" },
  71: { description: "Snow", icon: "❄️" },
  73: { description: "Snow", icon: "❄️" },
  75: { description: "Heavy Snow", icon: "❄️" },
  77: { description: "Snow", icon: "❄️" },
  80: { description: "Rain Showers", icon: "🌦️" },
  81: { description: "Rain Showers", icon: "🌦️" },
  82: { description: "Heavy Showers", icon: "🌧️" },
  85: { description: "Snow Showers", icon: "🌨️" },
  86: { description: "Snow Showers", icon: "🌨️" },
  95: { description: "Thunderstorm", icon: "⛈️" },
  96: { description: "Thunderstorm", icon: "⛈️" },
  99: { description: "Thunderstorm", icon: "⛈️" },
};

// Defaults to London, matching FamilyGroup.timezone's "Europe/London" default — override
// with real coordinates via WEATHER_LAT/WEATHER_LON once the household's location is known.
const DEFAULT_LAT = "51.5074";
const DEFAULT_LON = "-0.1278";

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const lat = process.env.WEATHER_LAT ?? DEFAULT_LAT;
  const lon = process.env.WEATHER_LON ?? DEFAULT_LON;

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
    { next: { revalidate: 600 } }
  );
  if (!res.ok) throw new Error("weather service unavailable");

  const body = await res.json();
  const code = body?.current_weather?.weathercode;
  const temperature = body?.current_weather?.temperature;
  if (typeof temperature !== "number") throw new Error("unexpected weather response");

  const match = WEATHER_CODES[code] ?? { description: "Unknown", icon: "🌡️" };
  return { tempC: Math.round(temperature), description: match.description, icon: match.icon };
}
