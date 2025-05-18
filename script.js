const continentCities = {
    Europe: [
      { name: "Paris", lat: 48.8566, lon: 2.3522 },
      { name: "Rome", lat: 41.9028, lon: 12.4964 },
      { name: "Berlin", lat: 52.52, lon: 13.405 },
      { name: "Barcelona", lat: 41.3851, lon: 2.1734 },
      { name: "Amsterdam", lat: 52.3676, lon: 4.9041 },
    ],
    Asia: [
      { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
      { name: "Seoul", lat: 37.5665, lon: 126.978 },
      { name: "Bangkok", lat: 13.7563, lon: 100.5018 },
      { name: "Singapore", lat: 1.3521, lon: 103.8198 },
      { name: "Delhi", lat: 28.6139, lon: 77.209 },
    ],
    NorthAmerica: [
      { name: "New York", lat: 40.7128, lon: -74.006 },
      { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
      { name: "Toronto", lat: 43.65107, lon: -79.347015 },
      { name: "Mexico City", lat: 19.4326, lon: -99.1332 },
      { name: "Chicago", lat: 41.8781, lon: -87.6298 },
    ],
  };
  
  function parseCoords(input) {
    const parts = input.split(",").map((s) => s.trim());
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    }
    return null;
  }
  
  async function getCoordinates(input) {
    const coords = parseCoords(input);
    if (coords) return { ...coords, cityName: input };
  
    const resp = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        input
      )}`
    );
    const data = await resp.json();
    if (!data.results || data.results.length === 0)
      throw new Error("Location not found");
    const res = data.results[0];
    return { lat: res.latitude, lon: res.longitude, cityName: `${res.name}, ${res.country}` };
  }
  
  function dateDiffInDays(date1, date2) {
    const diffTime = date2.getTime() - date1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  function cToF(c) {
    return c * 9 / 5 + 32;
  }
  
  function scoreWeather(minTempPref, maxTempPref, excludeRainPref, avgTempF, totalRain) {
    let score = 0;
    if (minTempPref !== null && maxTempPref !== null) {
      if (avgTempF >= minTempPref && avgTempF <= maxTempPref) score += 1;
    } else {
      score += 1;
    }
    if (excludeRainPref) {
      if (totalRain == 0) score += 1;
    } else {
      score += 1;
    }
    return score;
  }
  
  document.getElementById("trip-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const locationInput = document.getElementById("location").value.trim();
    const continent = document.getElementById("continent").value;
    const startDateInput = document.getElementById("start-date").value;
    const endDateInput = document.getElementById("end-date").value;
  
    const minTempInput = document.getElementById("min-temp").value;
    const maxTempInput = document.getElementById("max-temp").value;
    const excludeRain = document.getElementById("exclude-rain").checked;
  
    const minTempPref = minTempInput !== "" ? parseFloat(minTempInput) : null;
    const maxTempPref = maxTempInput !== "" ? parseFloat(maxTempInput) : null;
  
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "🔄 Fetching data...";
  
    if (!startDateInput || !endDateInput) {
      resultsDiv.innerHTML = "⚠️ Please select both start and end dates.";
      return;
    }
  
    const today = new Date();
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);
  
    if (startDate < today) {
      resultsDiv.innerHTML = "⚠️ Start date cannot be in the past.";
      return;
    }
    if (endDate < startDate) {
      resultsDiv.innerHTML = "⚠️ End date cannot be before start date.";
      return;
    }
  
    const tripLength = dateDiffInDays(startDate, endDate) + 1;
    if (tripLength > 16) {
      resultsDiv.innerHTML = "⚠️ Maximum trip length is 16 days (API limit).";
      return;
    }
  
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];
  
    if (locationInput) {
      try {
        const { lat, lon, cityName } = await getCoordinates(locationInput);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${startStr}&end_date=${endStr}`;
        const resp = await fetch(url);
        const data = await resp.json();
        const daily = data.daily;
  
        if (!daily || !daily.temperature_2m_max) {
          resultsDiv.innerHTML = "No weather data found for this location.";
          return;
        }
  
        let sumMax = 0,
          sumMin = 0,
          sumRain = 0;
        for (let i = 0; i < daily.temperature_2m_max.length; i++) {
          sumMax += daily.temperature_2m_max[i];
          sumMin += daily.temperature_2m_min[i];
          sumRain += daily.precipitation_sum[i];
        }
        const avgMaxC = sumMax / daily.temperature_2m_max.length;
        const avgMinC = sumMin / daily.temperature_2m_min.length;
        const totalRain = sumRain.toFixed(1);
  
        const avgMaxF = cToF(avgMaxC).toFixed(1);
        const avgMinF = cToF(avgMinC).toFixed(1);
        const avgTempF = (parseFloat(avgMaxF) + parseFloat(avgMinF)) / 2;
  
        const score = scoreWeather(minTempPref, maxTempPref, excludeRain, avgTempF, totalRain);
  
        resultsDiv.innerHTML = `<h3>Weather for ${cityName} from ${startStr} to ${endStr}:</h3>`;
        resultsDiv.innerHTML += `
          🌡️ Avg Temp: ${avgMinF} – ${avgMaxF} °F<br>
          🌧️ Total Precipitation: ${totalRain} mm<br>
          ✅ Score (based on preferences): ${score}
        `;
      } catch (err) {
        resultsDiv.innerHTML = `❌ Error: ${err.message}`;
      }
    } else if (continent) {
      try {
        const cities = continentCities[continent];
        if (!cities || cities.length === 0) {
          resultsDiv.innerHTML = "No cities found for selected continent.";
          return;
        }
  
        const promises = cities.map(async (city) => {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${startStr}&end_date=${endStr}`;
          const resp = await fetch(url);
          const data = await resp.json();
          if (!data.daily || !data.daily.temperature_2m_max) return null;
  
          let sumMax = 0,
            sumMin = 0,
            sumRain = 0;
          const len = data.daily.temperature_2m_max.length;
          for (let i = 0; i < len; i++) {
            sumMax += data.daily.temperature_2m_max[i];
            sumMin += data.daily.temperature_2m_min[i];
            sumRain += data.daily.precipitation_sum[i];
          }
          const avgMaxC = sumMax / len;
          const avgMinC = sumMin / len;
          const totalRain = sumRain;
  
          const avgMaxF = cToF(avgMaxC);
          const avgMinF = cToF(avgMinC);
          const avgTempF = (avgMaxF + avgMinF) / 2;
  
          const score = scoreWeather(minTempPref, maxTempPref, excludeRain, avgTempF, totalRain);
          return {
            name: city.name,
            avgMax: avgMaxF.toFixed(1),
            avgMin: avgMinF.toFixed(1),
            totalRain: totalRain.toFixed(1),
            score,
          };
        });
  
        const results = await Promise.all(promises);
        const validResults = results.filter((r) => r !== null);
  
        if (validResults.length === 0) {
          resultsDiv.innerHTML = "No weather data found for selected continent.";
          return;
        }
  
        validResults.sort((a, b) => b.score - a.score);
        const top5 = validResults.slice(0, 5);
  
        resultsDiv.innerHTML = `<h3>Top 5 destinations in ${continent} (${startStr} to ${endStr}):</h3>`;
        top5.forEach((city) => {
          resultsDiv.innerHTML += `
            <div class="city-card">
              <strong>${city.name}</strong><br>
              🌡️ Avg Temp: ${city.avgMin} – ${city.avgMax} °F<br>
              🌧️ Total Precipitation: ${city.totalRain} mm<br>
              ✅ Score: ${city.score}
            </div>
          `;
        });
      } catch (err) {
        resultsDiv.innerHTML = `❌ Error fetching weather: ${err.message}`;
      }
    } else {
      resultsDiv.innerHTML = "⚠️ Please provide either a location or select a continent.";
    }
  });
  