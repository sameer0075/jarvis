
require("dotenv").config();
const API_KEY = 'ab6b0d793b99c916055d6beeadc44e9e';
const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

async function fetchWeather(city) {
  try {
    const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const d = await res.json();
    console.log("weather result",d)

    if (d.cod !== 200) return JSON.stringify({ error: d.message });

    const result = JSON.stringify({
      city: d.name,
      country: d.sys.country,
      temp: Math.round(d.main.temp),
      feels_like: Math.round(d.main.feels_like),
      humidity: d.main.humidity,
      wind_kph: Math.round(d.wind.speed * 3.6),
      description: d.weather[0].description,
      icon: d.weather[0].icon,
    });

    return result;
  } catch (e) {
    console.log("error",e)
    return JSON.stringify({ error: e.message });
  }
}

async function fetchWeatherDetails(city) {
  try {
    const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const d = await res.json();
    console.log("weather result",d)

    if (d.cod !== 200) return JSON.stringify({ error: d.message });

    const result = {
      city: d.name,
      country: d.sys.country,
      temp: Math.round(d.main.temp),
      feels_like: Math.round(d.main.feels_like),
      humidity: d.main.humidity,
      wind_kph: Math.round(d.wind.speed * 3.6),
      description: d.weather[0].description,
      icon: d.weather[0].icon,
    };

    return result;
  } catch (e) {
    console.log("error weather",e)
    return JSON.stringify({ error: e.message });
  }
}

module.exports = { fetchWeather, fetchWeatherDetails };