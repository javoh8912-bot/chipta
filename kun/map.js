(() => {
  const searchForm = document.querySelector("#ticketSearch")
  if (!searchForm) return

  const cities = [
    { name: "Toshkent", lat: 41.2995, lng: 69.2401 },
    { name: "Samarqand", lat: 39.6542, lng: 66.9597 },
    { name: "Buxoro", lat: 39.7747, lng: 64.4286 },
    { name: "Qarshi", lat: 38.861, lng: 65.7847 },
    { name: "Nukus", lat: 42.4602, lng: 59.6174 },
    { name: "Andijon", lat: 40.7821, lng: 72.3442 },
    { name: "Farg'ona", lat: 40.3864, lng: 71.7864 },
    { name: "Namangan", lat: 41.0011, lng: 71.6726 },
    { name: "Jizzax", lat: 40.1254, lng: 67.8807 },
    { name: "Termiz", lat: 37.2242, lng: 67.2783 },
    { name: "Urganch", lat: 41.55, lng: 60.633 },
    { name: "Navoiy", lat: 40.1039, lng: 65.3688 },
    { name: "Guliston", lat: 40.4897, lng: 68.7842 },
    { name: "Chirchiq", lat: 41.4689, lng: 69.5822 }
  ]

  // O'zbekiston shaharlararo asosiy avtomobil va temir yo'llari tarmog'i (Road & Rail Graph)
  const roadEdges = [
    ["Toshkent", "Chirchiq", 35],
    ["Toshkent", "Guliston", 118],
    ["Toshkent", "Namangan", 285],
    ["Namangan", "Andijon", 68],
    ["Namangan", "Farg'ona", 82],
    ["Farg'ona", "Andijon", 75],
    ["Guliston", "Jizzax", 102],
    ["Jizzax", "Samarqand", 105],
    ["Samarqand", "Navoiy", 145],
    ["Navoiy", "Buxoro", 100],
    ["Samarqand", "Qarshi", 155],
    ["Buxoro", "Qarshi", 168],
    ["Qarshi", "Termiz", 295],
    ["Buxoro", "Urganch", 435],
    ["Urganch", "Nukus", 160]
  ]

  function findGroundRoute(startName, endName) {
    if (startName === endName) return [startName]
    const adj = {}
    cities.forEach(c => { adj[c.name] = [] })
    roadEdges.forEach(([u, v, dist]) => {
      if (adj[u] && adj[v]) {
        adj[u].push({ node: v, dist })
        adj[v].push({ node: u, dist })
      }
    })

    const queue = [[startName]]
    const visited = new Set([startName])
    while (queue.length > 0) {
      const path = queue.shift()
      const curr = path[path.length - 1]
      if (curr === endName) return path
      for (const edge of (adj[curr] || [])) {
        if (!visited.has(edge.node)) {
          visited.add(edge.node)
          queue.push([...path, edge.node])
        }
      }
    }
    return [startName, endName]
  }

  // Masofani havo bo'yicha hisoblash (Gavernus formulasi)
  function calcDistanceKm(c1, c2) {
    const R = 6371
    const dLat = (c2.lat - c1.lat) * Math.PI / 180
    const dLng = (c2.lng - c1.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  // Joriy sahifaga qarab birlamchi transport turini aniqlash
  const pathname = window.location.pathname.toLowerCase()
  let currentMode = pathname.includes("aviachipta") ? "flight" : pathname.includes("avtobus") ? "bus" : "train"

  const panel = document.createElement("section")
  panel.className = "city-map-panel"
  panel.setAttribute("aria-labelledby", "cityMapTitle")
  panel.innerHTML = `
    <div class="city-map-heading">
      <div>
        <h3 id="cityMapTitle">O'zbekiston transport xaritasi</h3>
        <p>Shaharlarni bosib tanlang — qatnov yo'nalishi va bekatlar avtomatik chiziladi</p>
      </div>
      <div class="city-map-controls">
        <div class="map-transport-toggle" role="group" aria-label="Transport turi">
          <button type="button" class="btn-map-mode ${currentMode === 'train' ? 'active' : ''}" data-mode="train" title="Poyezd temir yo'l magistrali">🚆 Poyezd</button>
          <button type="button" class="btn-map-mode ${currentMode === 'bus' ? 'active' : ''}" data-mode="bus" title="Avtobus qatnov yo'nalishi">🚌 Avtobus</button>
          <button type="button" class="btn-map-mode ${currentMode === 'flight' ? 'active' : ''}" data-mode="flight" title="To'g'ridan-to'g'ri samolyot parvozi">✈️ Samolyot</button>
        </div>
        <label for="cityMapTarget">Tanlanadigan bekat:
          <select id="cityMapTarget">
            <option value="fromCity">Qayerdan</option>
            <option value="toCity">Qayerga</option>
          </select>
        </label>
      </div>
    </div>
    <div class="city-map-route-info" id="cityMapRouteInfo" style="display:none;"></div>
    <p class="city-map-status" id="cityMapStatus" role="status">Xaritadan "Qayerdan" va "Qayerga" shaharlarini tanlang — yo'nalish chizig'i avtomatik ko'rsatiladi.</p>
    <div id="uzbekistanMap" class="city-map" aria-label="O'zbekiston shaharlari xaritasi"></div>
  `
  searchForm.insertAdjacentElement("afterend", panel)

  // Shaharlar datalistini to'ldirish
  const cityList = document.querySelector("#cities")
  if (cityList) {
    cityList.replaceChildren(...cities.map(city => {
      const option = document.createElement("option")
      option.value = city.name
      return option
    }))
  }

  const leafletCss = document.createElement("link")
  leafletCss.rel = "stylesheet"
  leafletCss.href = "https://unpkg.com/maplibre-gl@5.2.0/dist/maplibre-gl.css"
  document.head.append(leafletCss)

  const status = document.querySelector("#cityMapStatus")
  const routeInfo = document.querySelector("#cityMapRouteInfo")
  const mapScript = document.createElement("script")
  mapScript.src = "https://unpkg.com/maplibre-gl@5.2.0/dist/maplibre-gl.js"
  mapScript.onload = () => {
    const map = new maplibregl.Map({
      container: "uzbekistanMap",
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
        },
        layers: [{ id: "osm-raster", type: "raster", source: "osm" }]
      },
      center: [64.5, 41.1],
      zoom: 4.8,
      pitch: 28,
      bearing: -8,
      projection: "globe",
      renderWorldCopies: false
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right")

    const target = document.querySelector("#cityMapTarget")
    const markerMap = new Map()

    const markers = cities.map(city => {
      const el = document.createElement("div")
      el.className = "map-city-marker"
      el.innerHTML = `<span class="marker-dot"></span><span class="marker-label">${city.name}</span>`

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([city.lng, city.lat])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText(city.name))
        .addTo(map)

      el.addEventListener("click", e => {
        e.stopPropagation()
        selectCity(city)
      })
      markerMap.set(city.name, { city, marker, el })
      return { city, marker, el }
    })

    function selectCity(city) {
      const input = document.querySelector(`#${target.value}`)
      if (input) {
        input.value = city.name
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
      }
      status.textContent = `${city.name} — ${target.options[target.selectedIndex].text} manzili sifatida tanlandi.`

      // Boshqa bekatga avtomatik o'tkazish
      if (target.value === "fromCity") {
        target.value = "toCity"
      }
      updateRoute()
    }

    target.addEventListener("change", () => {
      status.textContent = `${target.options[target.selectedIndex].text} uchun xaritadagi shaharni bosing.`
    })

    // Transport rejimini almashtirish tugmalari
    panel.querySelectorAll(".btn-map-mode").forEach(btn => {
      btn.addEventListener("click", () => {
        panel.querySelectorAll(".btn-map-mode").forEach(b => b.classList.remove("active"))
        btn.classList.add("active")
        currentMode = btn.dataset.mode
        updateRoute()
      })
    })

    // Qidiruv maydonlari o'zgarganda xaritadagi chiziqni yangilash
    const fromInput = document.querySelector("#fromCity")
    const toInput = document.querySelector("#toCity")
    fromInput?.addEventListener("input", updateRoute)
    toInput?.addEventListener("input", updateRoute)
    fromInput?.addEventListener("change", updateRoute)
    toInput?.addEventListener("change", updateRoute)

    function updateRoute() {
      const fromName = fromInput ? fromInput.value.trim() : ""
      const toName = toInput ? toInput.value.trim() : ""

      // Barcha markerlarni standart holatga qaytarish
      markerMap.forEach(item => {
        item.el.classList.remove("start-city", "end-city", "waypoint-city")
      })

      if (!fromName || !toName || fromName === toName) {
        removeRouteLayers()
        if (fromName && markerMap.has(fromName)) markerMap.get(fromName).el.classList.add("start-city")
        if (toName && markerMap.has(toName)) markerMap.get(toName).el.classList.add("end-city")
        routeInfo.style.display = "none"
        return
      }

      const fromCity = cities.find(c => c.name.toLowerCase() === fromName.toLowerCase())
      const toCity = cities.find(c => c.name.toLowerCase() === toName.toLowerCase())

      if (!fromCity || !toCity) {
        removeRouteLayers()
        return
      }

      markerMap.get(fromCity.name)?.el.classList.add("start-city")
      markerMap.get(toCity.name)?.el.classList.add("end-city")

      let routeCoords = []
      let pathNames = []
      let totalKm = 0

      if (currentMode === "flight") {
        // SAMOLYOT: "samalyotni to'g'ri chiziq qil u uchadiku barbir"
        // To'g'ridan-to'g'ri havo yo'li to'g'ri chiziq bilan tortiladi
        routeCoords = [
          [fromCity.lng, fromCity.lat],
          [toCity.lng, toCity.lat]
        ]
        totalKm = calcDistanceKm(fromCity, toCity)
        pathNames = [fromCity.name, toCity.name]
        routeInfo.innerHTML = `
          <div class="route-badge flight">
            <strong>✈️ Samolyot parvozi:</strong>
            <span>${fromCity.name} ➔ ${toCity.name}</span>
            <small>To'g'ridan-to'g'ri havo yo'lagi · ~${totalKm} km</small>
          </div>
        `
        status.textContent = `✈️ Parvoz yo'nalishi: ${fromCity.name} dan ${toCity.name} ga to'g'ri havo chizig'i tortildi (~${totalKm} km).`
      } else if (currentMode === "bus") {
        // AVTOBUS: "avtobus qayerlardan o'tishi ko'rinishi uchun"
        // Avtomobil yo'llari bo'ylab oraliq shaharlar yo'li tortiladi
        pathNames = findGroundRoute(fromCity.name, toCity.name)
        routeCoords = pathNames.map(name => {
          const c = cities.find(city => city.name === name)
          return [c.lng, c.lat]
        })
        // Oraliq shaharlarni belgilash
        pathNames.forEach((name, idx) => {
          if (idx > 0 && idx < pathNames.length - 1) {
            markerMap.get(name)?.el.classList.add("waypoint-city")
          }
        })
        for (let i = 0; i < pathNames.length - 1; i++) {
          const c1 = cities.find(c => c.name === pathNames[i])
          const c2 = cities.find(c => c.name === pathNames[i + 1])
          totalKm += Math.round(calcDistanceKm(c1, c2) * 1.18) // Avtomobil trassasi koeffitsiyenti
        }
        routeInfo.innerHTML = `
          <div class="route-badge bus">
            <strong>🚌 Avtobus qatnov yo'nalishi:</strong>
            <span>${pathNames.join(" → ")}</span>
            <small>Avtomobil trassasi bo'ylab barcha oraliq shaharlar ko'rsatilgan · ~${totalKm} km</small>
          </div>
        `
        status.textContent = `🚌 Avtobus yo'nalishi: ${pathNames.join(" → ")} (~${totalKm} km). Qayerlardan o'tishi xaritada ko'rsatildi.`
      } else {
        // POYEZD: Temir yo'l magistrali bo'ylab
        pathNames = findGroundRoute(fromCity.name, toCity.name)
        routeCoords = pathNames.map(name => {
          const c = cities.find(city => city.name === name)
          return [c.lng, c.lat]
        })
        pathNames.forEach((name, idx) => {
          if (idx > 0 && idx < pathNames.length - 1) {
            markerMap.get(name)?.el.classList.add("waypoint-city")
          }
        })
        for (let i = 0; i < pathNames.length - 1; i++) {
          const c1 = cities.find(c => c.name === pathNames[i])
          const c2 = cities.find(c => c.name === pathNames[i + 1])
          totalKm += Math.round(calcDistanceKm(c1, c2) * 1.15)
        }
        routeInfo.innerHTML = `
          <div class="route-badge train">
            <strong>🚆 Temir yo'l yo'nalishi:</strong>
            <span>${pathNames.join(" → ")}</span>
            <small>Poyezd temir yo'l magistrali stansiyalari · ~${totalKm} km</small>
          </div>
        `
        status.textContent = `🚆 Poyezd temir yo'l yo'nalishi: ${pathNames.join(" → ")} (~${totalKm} km).`
      }

      routeInfo.style.display = "block"
      drawRouteLine(routeCoords, currentMode)
    }

    function removeRouteLayers() {
      if (map.getLayer("route-line-core")) map.removeLayer("route-line-core")
      if (map.getLayer("route-line-glow")) map.removeLayer("route-line-glow")
      if (map.getSource("route-source")) map.removeSource("route-source")
    }

    function drawRouteLine(coords, mode) {
      if (!map.isStyleLoaded()) {
        map.once("load", () => drawRouteLine(coords, mode))
        return
      }

      const geojsonData = {
        type: "Feature",
        properties: { mode: mode },
        geometry: {
          type: "LineString",
          coordinates: coords
        }
      }

      const colorMap = {
        flight: { main: "#0284c7", glow: "#38bdf8", width: 3.5, dash: [2, 2] },
        bus: { main: "#ea580c", glow: "#fb923c", width: 4.8, dash: [1] },
        train: { main: "#1d4ed8", glow: "#60a5fa", width: 4.8, dash: [1] }
      }[mode] || { main: "#1d4ed8", glow: "#60a5fa", width: 4.5, dash: [1] }

      if (map.getSource("route-source")) {
        map.getSource("route-source").setData(geojsonData)
        map.setPaintProperty("route-line-core", "line-color", colorMap.main)
        map.setPaintProperty("route-line-core", "line-width", colorMap.width)
        map.setPaintProperty("route-line-core", "line-dasharray", colorMap.dash)
        map.setPaintProperty("route-line-glow", "line-color", colorMap.glow)
      } else {
        map.addSource("route-source", {
          type: "geojson",
          data: geojsonData
        })

        // Nurlanish (glow) qatlami
        map.addLayer({
          id: "route-line-glow",
          type: "line",
          source: "route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": colorMap.glow,
            "line-width": 9,
            "line-opacity": 0.38
          }
        })

        // Asosiy yo'nalish chizig'i
        map.addLayer({
          id: "route-line-core",
          type: "line",
          source: "route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": colorMap.main,
            "line-width": colorMap.width,
            "line-dasharray": colorMap.dash
          }
        })
      }

      // Xaritani marshrutga moslab yaqinlashtirish
      if (coords.length >= 2) {
        const bounds = coords.reduce(
          (b, coord) => b.extend(coord),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        )
        map.fitBounds(bounds, {
          padding: { top: 60, bottom: 60, left: 60, right: 60 },
          duration: 900,
          maxZoom: 7.5
        })
      }
    }

    map.on("click", event => {
      const nearest = markers
        .map(item => {
          const point = map.project([item.city.lng, item.city.lat])
          return { ...item, distance: Math.hypot(point.x - event.point.x, point.y - event.point.y) }
        })
        .sort((a, b) => a.distance - b.distance)[0]
      if (nearest && nearest.distance <= 35) {
        selectCity(nearest.city)
      } else {
        status.textContent = "Bekat tanlash uchun xaritadagi shahar belgisini bosing."
      }
    })

    map.on("error", () => {
      status.textContent = "Xarita tasvirini yuklab bo'lmadi. Internet ulanishini tekshiring yoki shahar nomini yozing."
    })
    map.once("load", () => {
      map.resize()
      updateRoute()
    })
  }
  mapScript.onerror = () => {
    status.textContent = "Interaktiv xarita yuklanmadi. Shahar nomini yuqoridagi qidiruv maydoniga yozing."
  }
  document.head.append(mapScript)
})()
