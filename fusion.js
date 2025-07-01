document.addEventListener("DOMContentLoaded", () => {
  const map = L.map("map").setView([45.75, 4.85], 13);
  let layerControl = L.control
    .layers(null, {}, { collapsed: false })
    .addTo(map);
  let zonagesLoaded = false;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const searchBox = document.getElementById("search-box");
  const geolocateBtn = document.getElementById("geolocate-btn");
  const zonagesBtn = document.getElementById("zonages-btn");
  const resourcesBtn = document.getElementById("resources-btn");
  const infoPanel = document.getElementById("info-panel");
  const infoContent = document.getElementById("info-content");

  const APICARTO_LAYERS = {
    "ZNIEFF I": {
      endpoint: "https://apicarto.ign.fr/api/nature/znieff1",
      style: {
        color: "#AFB42B",
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.2,
        dashArray: "5, 5",
      },
    },
    "ZNIEFF II": {
      endpoint: "https://apicarto.ign.fr/api/nature/znieff2",
      style: { color: "#E65100", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    "Natura 2000 (Habitats)": {
      endpoint: "https://apicarto.ign.fr/api/nature/natura-habitat",
      style: { color: "#2E7D32", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    "Réserves Naturelles Nationales": {
      endpoint: "https://apicarto.ign.fr/api/nature/rnn",
      style: { color: "#7B1FA2", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    "Parcs Nationaux": {
      endpoint: "https://apicarto.ign.fr/api/nature/pn",
      style: { color: "#AD1457", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    "Parcs Naturels Régionaux": {
      endpoint: "https://apicarto.ign.fr/api/nature/pnr",
      style: { color: "#558B2F", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
  };

  // Logique de recherche d'adresse
  searchBox.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const address = searchBox.value;
      if (address) {
        fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${address}`,
        )
          .then((response) => response.json())
          .then((data) => {
            if (data && data.length > 0) {
              const { lat, lon } = data[0];
              map.setView([lat, lon], 15);
            }
          });
      }
    }
  });

  // Logique de géolocalisation
  geolocateBtn.addEventListener("click", () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 15);
      });
    }
  });

  // Affichage des zonages
  zonagesBtn.addEventListener("click", () => {
    if (!zonagesLoaded) {
      const center = map.getCenter();
      Object.entries(APICARTO_LAYERS).forEach(([name, config]) => {
        fetchAndDisplayApiLayer(name, config, center.lat, center.lng);
      });
      zonagesLoaded = true;
    }
  });

  async function fetchAndDisplayApiLayer(name, config, lat, lon) {
    try {
      const url = `${config.endpoint}?lon=${lon}&lat=${lat}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Réponse réseau non OK: ${response.statusText}`);
      }
      const geojsonData = await response.json();

      if (
        geojsonData &&
        geojsonData.features &&
        geojsonData.features.length > 0
      ) {
        const geoJsonLayer = L.geoJSON(geojsonData, {
          style: config.style,
        });
        layerControl.addOverlay(geoJsonLayer, name);
        geoJsonLayer.addTo(map);
      } else {
        console.log(`Aucune donnée de type "${name}" trouvée pour ce point.`);
      }
    } catch (error) {
      console.error(`Erreur lors du chargement de la couche ${name}:`, error);
    }
  }

  // Logique pour le clic droit/appui long
  map.on("contextmenu", (e) => {
    const latlng = e.latlng;
    const popupContent = `
            <b>Coordonnées :</b> ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}<br>
            <button onclick="showFlorePatrimoniale(${latlng.lat}, ${latlng.lng})">Flore patrimoniale</button>
            <button onclick="showTouteLaFlore(${latlng.lat}, ${latlng.lng})">Toute la flore</button>
        `;
    L.popup().setLatLng(latlng).setContent(popupContent).openOn(map);
  });

  // Ressources complémentaires
  resourcesBtn.addEventListener("click", () => {
    const center = map.getCenter();
    const { lat, lng } = center;
    const resourcesContent = `
            <h3>Ressources complémentaires</h3>
            <ul>
                <li><a href="https://www.geoportail.gouv.fr/carte?c=${lng},${lat}&z=15&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&l1=AGRICULTURE.CARTE.PEDOLOGIQUE::GEOPORTAIL:OGC:WMS(0.5)&permalink=yes" target="_blank">Géoportail - Carte des sols</a></li>
                <li><a href="https://www.inaturalist.org/observations?lat=${lat}&lng=${lng}&radius=5&subview=map&threatened&iconic_taxa=Plantae" target="_blank">iNaturalist - Observations</a></li>
                <li><a href="https://remonterletemps.ign.fr/comparer?lon=${lng}&lat=${lat}&z=17&layer1=16&layer2=19&mode=split-h" target="_blank">IGN Remonter le temps</a></li>
            </ul>
        `;
    infoContent.innerHTML = resourcesContent;
    infoPanel.classList.remove("hidden");
  });

  let rulesByTaxonIndex = new Map();

  // Charger et parser BDCstatut.csv
  fetch("BDCstatut.csv")
    .then((response) => response.text())
    .then((csvText) => {
      const lines = csvText.trim().split(/\r?\n/);
      const header = lines
        .shift()
        .split(";")
        .map((h) => h.trim().replace(/"/g, ""));
      const indices = {
        adm: header.indexOf("LB_ADM_TR"),
        nom: header.indexOf("LB_NOM"),
        code: header.indexOf("CODE_STATUT"),
        type: header.indexOf("LB_TYPE_STATUT"),
        label: header.indexOf("LABEL_STATUT"),
      };

      lines.forEach((line) => {
        const cols = line.split(";");
        const rowData = {
          adm: cols[indices.adm]?.trim().replace(/"/g, "") || "",
          nom: cols[indices.nom]?.trim().replace(/"/g, "") || "",
          code: cols[indices.code]?.trim().replace(/"/g, "") || "",
          type: cols[indices.type]?.trim().replace(/"/g, "") || "",
          label: cols[indices.label]?.trim().replace(/"/g, "") || "",
        };
        if (rowData.nom && rowData.type) {
          if (!rulesByTaxonIndex.has(rowData.nom)) {
            rulesByTaxonIndex.set(rowData.nom, []);
          }
          rulesByTaxonIndex.get(rowData.nom).push(rowData);
        }
      });
      console.log(
        `Référentiel chargé, ${rulesByTaxonIndex.size} taxons indexés.`,
      );
    });

  // Fonctions pour afficher les informations
  window.showFlorePatrimoniale = (lat, lng) => {
    runAnalysis({ latitude: lat, longitude: lng });
  };

  window.showTouteLaFlore = (lat, lng) => {
    loadObservationsAt({ latitude: lat, longitude: lng });
  };

  const SEARCH_RADIUS_KM = 2;
  const OBS_RADIUS_KM = 1;

  const setStatus = (message, isLoading = false) => {
    infoContent.innerHTML = "";
    if (isLoading) {
      const spinner = document.createElement("div");
      spinner.className = "loading";
      infoContent.appendChild(spinner);
    }
    if (message) infoContent.innerHTML += `<p>${message}</p>`;
    infoPanel.classList.remove("hidden");
  };

  const runAnalysis = async (params) => {
    try {
      setStatus("Analyse de la flore patrimoniale en cours...", true);
      const wkt = `POLYGON((${Array.from({ length: 33 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 32,
          r = 111.32 * Math.cos((params.latitude * Math.PI) / 180);
        return `${(params.longitude + (SEARCH_RADIUS_KM / r) * Math.cos(a)).toFixed(5)} ${(params.latitude + (SEARCH_RADIUS_KM / 111.132) * Math.sin(a)).toFixed(5)}`;
      }).join(", ")}))`;
      const gbifUrl = `https://api.gbif.org/v1/occurrence/search?limit=1000&geometry=${encodeURIComponent(wkt)}&kingdomKey=6`;
      const gbifResp = await fetch(gbifUrl);
      if (!gbifResp.ok) throw new Error("L'API GBIF est indisponible.");
      const pageData = await gbifResp.json();
      if (pageData.results?.length > 0) {
        const uniqueSpeciesNames = [
          ...new Set(pageData.results.map((o) => o.species).filter(Boolean)),
        ];
        const patrimonialSpecies = [];
        for (const speciesName of uniqueSpeciesNames) {
          const rules = rulesByTaxonIndex.get(speciesName);
          if (rules) {
            patrimonialSpecies.push({
              name: speciesName,
              rules: rules.map((r) => r.label).join(", "),
            });
          }
        }

        if (patrimonialSpecies.length > 0) {
          infoContent.innerHTML = `<h3>Flore patrimoniale</h3><ul>${patrimonialSpecies.map((s) => `<li><b>${s.name}</b>: ${s.rules}</li>`).join("")}</ul>`;
        } else {
          infoContent.innerHTML =
            "<h3>Flore patrimoniale</h3><p>Aucune espèce patrimoniale trouvée.</p>";
        }
      } else {
        infoContent.innerHTML =
          "<h3>Flore patrimoniale</h3><p>Aucune espèce trouvée.</p>";
      }
      infoPanel.classList.remove("hidden");
    } catch (error) {
      console.error("Erreur durant l'analyse:", error);
      setStatus(`Erreur : ${error.message}`);
    }
  };

  const loadObservationsAt = async (params) => {
    try {
      setStatus("Chargement des observations locales en cours...", true);
      const wkt = `POLYGON((${Array.from({ length: 33 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 32,
          r = 111.32 * Math.cos((params.latitude * Math.PI) / 180);
        return `${(params.longitude + (OBS_RADIUS_KM / r) * Math.cos(a)).toFixed(5)} ${(params.latitude + (OBS_RADIUS_KM / 111.132) * Math.sin(a)).toFixed(5)}`;
      }).join(", ")}))`;
      const gbifUrl = `https://api.gbif.org/v1/occurrence/search?limit=300&geometry=${encodeURIComponent(wkt)}&taxonKey=7707728`;
      const resp = await fetch(gbifUrl);
      if (!resp.ok) throw new Error("L'API GBIF est indisponible.");
      const data = await resp.json();
      if (data.results?.length > 0) {
        const species = [
          ...new Set(data.results.map((o) => o.species).filter(Boolean)),
        ];
        infoContent.innerHTML = `<h3>Toute la flore</h3><ul>${species.map((s) => `<li>${s}</li>`).join("")}</ul>`;
      } else {
        infoContent.innerHTML =
          "<h3>Toute la flore</h3><p>Aucune observation trouvée.</p>";
      }
      infoPanel.classList.remove("hidden");
    } catch (error) {
      console.error("Erreur durant le chargement des observations:", error);
      setStatus(`Erreur : ${error.message}`);
    }
  };
});
