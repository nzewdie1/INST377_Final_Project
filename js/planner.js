const form = document.getElementById('trip-form');
const results = document.getElementById('results');
const minTempSlider = document.getElementById('min-temp');
const minTempVal = document.getElementById('min-temp-val');

minTempSlider.addEventListener('input', () => {
  minTempVal.textContent = minTempSlider.value;
});

const cities = [
  { name: "New York", lat: 40.7128, lon: -74.0060, continent: "North America" },
  { name: "London", lat: 51.5072, lon: -0.1276, continent: "Europe" },
  { name: "Tokyo", lat: 35.6895, lon: 139.6917, continent: "Asia" },
  { name: "Rio de Janeiro", lat: -22.9068, lon: -43.1729, continent: "South America" },
  { name: "Cape Town", lat: -33.9249, lon: 18.4241, continent: "Africa" },
  { name: "Toronto", lat: 43.651070, lon: -79.347015, continent: "North America" },
  { name: "Paris", lat: 48.8566, lon: 2.3522, continent: "Europe" }
];

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  results.innerHTML = "Loading...";

  const start = new Date(document.getElementById("start-date").value);
  const end = new Date(document.getElementById("end-date").value);
  const cityInput = document.getElementById("city-input").value.trim().toLowerCase();
  const continent = document.getElementById("continent").value;
  const preferredTempF = parseInt(minTempSlider.value);
  const excludeRain = document.getElementById("no-rain").checked;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    results.innerHTML = "Please select a valid date range.";
    return;
  }

  const matchingCities = cityInput
    ? cities.filter(c => c.name.toLowerCase().includes(cityInput))
    : cities.filter(c => !continent || c.continent === continent);

  const resultsArr = [];

  for (const city of matchingCities) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&start_date=${start.toISOString().slice(0, 10)}&end_date=${end.toISOString().slice(0, 10)}&temperature_unit=fahrenheit&daily=temperature_2m_max,precipitation_sum&timezone=auto`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();

      const temps = data.daily.temperature_2m_max;
      const rain = data.daily.precipitation_sum;
      const days = data.daily.time;

      const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      const rainTotal = rain.reduce((a, b) => a + b, 0);

      if (avgTemp >= preferredTempF && (!excludeRain || rainTotal < 5)) {
        resultsArr.push({
          name: city.name,
          avgTemp: avgTemp.toFixed(1),
          rainTotal,
          days,
          temps
        });
      }
    } catch (err) {
      console.error("API error for", city.name);
    }
  }

  results.innerHTML = "";

  if (resultsArr.length === 0) {
    results.innerHTML = "No destinations match your preferences.";
    return;
  }

  resultsArr.sort((a, b) => b.avgTemp - a.avgTemp);
  resultsArr.slice(0, 5).forEach(place => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <h3>${place.name}</h3>
      <p>Avg Temp: ${place.avgTemp}°F</p>
      <p>Total Rain: ${place.rainTotal.toFixed(1)} mm</p>
      <canvas id="chart-${place.name}"></canvas>
      <button onclick="saveTrip('${place.name}')">Save Trip</button>
    `;
    results.appendChild(card);

    new Chart(document.getElementById(`chart-${place.name}`), {
      type: 'line',
      data: {
        labels: place.days,
        datasets: [{
          label: 'Max Temp (°F)',
          data: place.temps,
          borderColor: '#1e90ff',
          fill: false
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  });
});

async function saveTrip(city) {
  const res = await fetch('/api/save-trip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city, savedAt: new Date().toISOString() })
  });

  if (res.ok) {
    alert(`${city} trip saved!`);
  } else {
    alert("Failed to save trip.");
  }
}
