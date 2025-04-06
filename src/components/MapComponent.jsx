import React, { useRef, useState, useEffect } from "react";
import {
  useJsApiLoader,
  GoogleMap,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";
import Papa from "papaparse";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

const COLORS = ["#0088FE", "#FF8042"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MapComponent = () => {
  // Existing state variables
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [solarData, setSolarData] = useState([]);
  const [matchedData, setMatchedData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("May");
  const [predictionResult, setPredictionResult] = useState(null);
  // New state for map zoom level
  const [mapZoom, setMapZoom] = useState(13);

  // Dropdown toggles for right panel
  const [showCalculator, setShowCalculator] = useState(false);
  const [showInstallation, setShowInstallation] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Month slider state (using the month index)
  const [monthIndex, setMonthIndex] = useState(MONTHS.indexOf("May"));

  // Personal Solar Calculator state
  const [panelArea, setPanelArea] = useState(5);
  const [monthlyBill, setMonthlyBill] = useState(40);
  const [calculatedResults, setCalculatedResults] = useState({
    annualEnergy: 0,
    carbonOffset: 0,
    treeEquivalent: 0,
    monthlySavingKWh: 0,
    monthlySavingMoney: 0,
  });

  // Solar Potential Analysis state
  const [analysisMonthlyBill, setAnalysisMonthlyBill] = useState(100); // $ per month
  const [energyCostPerKWh, setEnergyCostPerKWh] = useState(0.15); // $ per kWh
  const [solarIncentives, setSolarIncentives] = useState(40); // percentage discount
  const [panelCapacityWatts, setPanelCapacityWatts] = useState(300); // watts per panel
  const [panelCount, setPanelCount] = useState(10); // number of panels
  const [installationCostPerWatt, setInstallationCostPerWatt] = useState(4); // cost per watt in $

  const autocompleteRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "ADD-YOUR-API-KEY",
    libraries: ["places"],
  });

  useEffect(() => {
    fetch("/data/chicago_data.csv")
      .then((res) => res.text())
      .then((text) =>
        Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          complete: (results) => setSolarData(results.data),
        })
      );
  }, []);

  // Recalculate Personal Solar Calculator values
  useEffect(() => {
    const solarEnergyValue = predictionResult || 4.5;
    if (panelArea > 0 && monthlyBill > 0) {
      const electricityRate = 0.15;
      const monthlyUsage = monthlyBill / electricityRate;
      const annualEnergy = solarEnergyValue * panelArea * 0.18 * 365;
      const carbonOffset = (annualEnergy * 0.85) / 2000;
      const treeEquivalent = Math.round((carbonOffset * 2000) / 48);
      const monthlySavingKWh = Math.min(annualEnergy / 12, monthlyUsage);
      const monthlySavingMoney = monthlySavingKWh * electricityRate;
      setCalculatedResults({
        annualEnergy: annualEnergy.toFixed(2),
        carbonOffset: carbonOffset.toFixed(2),
        treeEquivalent,
        monthlySavingKWh: monthlySavingKWh.toFixed(2),
        monthlySavingMoney: monthlySavingMoney.toFixed(2),
      });
    }
  }, [panelArea, monthlyBill, predictionResult]);

  // Solar Potential Analysis Calculations
  const avgSunHours = 4;
  const totalCapacityWatts = panelCount * panelCapacityWatts;
  const yearlyProduction = (totalCapacityWatts / 1000) * avgSunHours * 365;
  const monthlyConsumption = analysisMonthlyBill / energyCostPerKWh;
  const yearlyConsumption = monthlyConsumption * 12;
  const energyCoveredFraction = Math.min(yearlyProduction / yearlyConsumption, 1);
  const installationCost = totalCapacityWatts * installationCostPerWatt;
  const netInstallationCost = installationCost * (1 - solarIncentives / 100);

  let breakEvenYear = null;
  const analysisData = [];
  for (let y = 0; y <= 20; y++) {
    const costWithoutSolar = analysisMonthlyBill * 12 * y;
    const costWithSolar =
      netInstallationCost + analysisMonthlyBill * (1 - energyCoveredFraction) * 12 * y;
    const savings = costWithoutSolar - costWithSolar;
    analysisData.push({
      year: y,
      costWithoutSolar,
      costWithSolar,
      savings,
    });
    if (breakEvenYear === null && costWithSolar <= costWithoutSolar) {
      breakEvenYear = y;
    }
  }

  // Helper to calculate sine and cosine features
  const getMonthFeatures = (monthLabel) => {
    const index = MONTHS.indexOf(monthLabel);
    const angle = (2 * Math.PI * index) / 12;
    return {
      sin: Math.sin(angle),
      cos: Math.cos(angle),
    };
  };

  const handlePlaceChanged = async () => {
    const place = autocompleteRef.current.getPlace();
    if (place && place.geometry) {
      const loc = place.geometry.location;
      const regionName = place.address_components?.find((c) =>
        c.types.includes("locality")
      )?.long_name;
      const lat = loc.lat();
      const lng = loc.lng();
      const { sin, cos } = getMonthFeatures(selectedMonth);

      try {
        const res = await axios.post("http://localhost:5000/predict", {
          Latitude: lat,
          Longitude: lng,
          Month_sin: sin,
          Month_cos: cos,
          ALLSKY_KT: 0.47,
          ALLSKY_SFC_LW_DWN: 7.43,
        });
        setPredictionResult(res.data.prediction);
      } catch (err) {
        console.error("Prediction error", err);
        setPredictionResult(null);
      }

      setSelectedPlace({
        name: place.name || "No name",
        address: place.formatted_address || "No address",
        coordinates: { lat, lng },
      });
      setMarkerPosition({ lat, lng });
      // Zoom into the location when found
      setMapZoom(19);

      const match = solarData.find(
        (entry) =>
          entry.region_name?.toLowerCase() === regionName?.toLowerCase()
      );
      setMatchedData(match || null);
    }
  };

  const handleMonthSliderChange = (e) => {
    const index = parseInt(e.target.value, 10);
    setMonthIndex(index);
    const month = MONTHS[index];
    setSelectedMonth(month);
    if (selectedPlace) {
      const { lat, lng } = selectedPlace.coordinates;
      const { sin, cos } = getMonthFeatures(month);
      axios
        .post("http://localhost:5000/predict", {
          Latitude: lat,
          Longitude: lng,
          Month_sin: sin,
          Month_cos: cos,
          ALLSKY_KT: 0.6,
          ALLSKY_SFC_LW_DWN: 300,
        })
        .then((res) => setPredictionResult(res.data.prediction))
        .catch(() => setPredictionResult(null));
    }
  };

  const handlePanelAreaChange = (e) => {
    setPanelArea(parseFloat(e.target.value) || 0);
  };

  const handleMonthlyBillChange = (e) => {
    setMonthlyBill(parseFloat(e.target.value) || 0);
  };

  const handleAnalysisMonthlyBillChange = (e) => {
    setAnalysisMonthlyBill(parseFloat(e.target.value) || 0);
  };

  const handleEnergyCostChange = (e) => {
    setEnergyCostPerKWh(parseFloat(e.target.value) || 0);
  };

  const handleSolarIncentivesChange = (e) => {
    setSolarIncentives(parseFloat(e.target.value) || 0);
  };

  const handlePanelCapacityChange = (e) => {
    setPanelCapacityWatts(parseFloat(e.target.value) || 0);
  };

  const handlePanelCountChange = (e) => {
    setPanelCount(parseInt(e.target.value, 10) || 1);
  };

  const handleInstallationCostChange = (e) => {
    setInstallationCostPerWatt(parseFloat(e.target.value) || 0);
  };

  const toggleCalculator = () => setShowCalculator((prev) => !prev);
  const toggleInstallation = () => setShowInstallation((prev) => !prev);
  const toggleAnalysis = () => setShowAnalysis((prev) => !prev);

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "95vh",
        margin: 0,
        padding: 0,
        marginTop: "2vh",
      }}
    >
      {/* Left Column: Map with Month Slider and Selected Place Card */}
      <div style={{ flex: 2, position: "relative" }}>
        <GoogleMap
          center={markerPosition || { lat: 41.8781, lng: -87.6298 }}
          zoom={mapZoom}
          mapContainerStyle={{ width: "100%", height: "95vh" }}
          mapTypeId="satellite"
          options={{
            tilt: 0,
            heading: 0,
            disableDefaultUI: false,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
          }}
        >
          {markerPosition && <Marker position={markerPosition} />}
        </GoogleMap>

        {selectedPlace && (
          <div
            style={{
              position: "absolute",
              bottom: "30px",
              left: "30px",
              background: "rgba(0, 0, 0, 0.85)",
              color: "#fff",
              padding: "15px",
              borderRadius: "10px",
              maxWidth: "280px",
              fontSize: "14px",
              zIndex: 10,
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>
              Selected Place
            </h3>
            <p>
              <strong>Name:</strong> {selectedPlace.name}
            </p>
            <p>
              <strong>Address:</strong> {selectedPlace.address}
            </p>
            <p>
              <strong>Coordinates:</strong>{" "}
              {selectedPlace.coordinates.lat.toFixed(4)},{" "}
              {selectedPlace.coordinates.lng.toFixed(4)}
            </p>
            <p>
              <strong>Selected Month:</strong> {selectedMonth}
            </p>
            <p>
              <strong>Predicted daily Solar Energy:</strong>{" "}
              {predictionResult !== null
                ? `${predictionResult.toFixed(2)} kWh/m`
                : "N/A"}
              <sup>2</sup>
            </p>
          </div>
        )}

        {/* Month Slider */}
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.9)",
            padding: "10px 20px",
            borderRadius: "5px",
          }}
        >
          <input
            type="range"
            min="0"
            max="11"
            value={monthIndex}
            onChange={handleMonthSliderChange}
            style={{ width: "300px" }}
          />
          <div style={{ textAlign: "center", fontWeight: "bold" }}>
            {selectedMonth}
          </div>
        </div>
      </div>

      {/* Right Column: Controls Panel */}
      <div style={{ flex: 1, overflowY: "auto", background: "#f5f5f5", padding: "20px" }}>
        {/* Location Search */}
        <Autocomplete
          onLoad={(auto) => (autocompleteRef.current = auto)}
          onPlaceChanged={handlePlaceChanged}
        >
          <input
            type="text"
            placeholder="Search for a location"
            style={{
              width: "100%",
              padding: "10px",
              fontSize: "16px",
              borderRadius: "5px",
              border: "1px solid #ddd",
              marginBottom: "20px",
            }}
          />
        </Autocomplete>

        {/* Personal Solar Calculator Dropdown */}
        <div style={{ marginBottom: "20px" }}>
          <div
            onClick={toggleCalculator}
            style={{
              background: "#0277bd",
              color: "#fff",
              padding: "10px",
              borderRadius: "5px",
              cursor: "pointer",
              marginBottom: "10px",
            }}
          >
            Personal Solar Calculator
          </div>
          {showCalculator && (
            <div
              style={{
                background: "#fff",
                padding: "15px",
                borderRadius: "5px",
                marginBottom: "20px",
              }}
            >
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontWeight: "900" }}>Panel Area (m²):</label>
                <input
                  type="number"
                  min="0"
                  value={panelArea || ""}
                  onChange={handlePanelAreaChange}
                  placeholder="Enter panel area"
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "16px",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                    marginTop: "5px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontWeight: "900" }}>
                  Monthly Electricity Bill ($):
                </label>
                <input
                  type="number"
                  min="0"
                  value={monthlyBill || ""}
                  onChange={handleMonthlyBillChange}
                  placeholder="Enter monthly bill"
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "16px",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                    marginTop: "5px",
                  }}
                />
              </div>
              {(panelArea > 0 && monthlyBill > 0) ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "40px" }}>⚡</div>
                  <div style={{ fontWeight: "bold", fontSize: "18px" }}>
                    Annual Energy
                  </div>
                  <div style={{ fontSize: "20px", color: "#0277bd" }}>
                    {calculatedResults.annualEnergy} kWh
                  </div>
                  <div style={{ fontSize: "40px", marginTop: "10px" }}>🌱</div>
                  <div style={{ fontWeight: "bold", fontSize: "18px" }}>
                    Carbon Offset
                  </div>
                  <div style={{ fontSize: "20px", color: "#2e7d32" }}>
                    {calculatedResults.carbonOffset} tons/yr
                  </div>
                  <div style={{ fontSize: "40px", marginTop: "10px" }}>🌳</div>
                  <div style={{ fontWeight: "bold", fontSize: "18px" }}>
                    Tree Equivalent
                  </div>
                  <div style={{ fontSize: "20px", color: "#33691e" }}>
                    {calculatedResults.treeEquivalent} trees/yr
                  </div>
                  <div style={{ fontSize: "40px", marginTop: "10px" }}>⚙️</div>
                  <div style={{ fontWeight: "bold", fontSize: "18px" }}>
                    Monthly Energy Saving
                  </div>
                  <div style={{ fontSize: "20px", color: "#01579b" }}>
                    {calculatedResults.monthlySavingKWh} kWh
                  </div>
                  <div style={{ fontSize: "40px", marginTop: "10px" }}>💰</div>
                  <div style={{ fontWeight: "bold", fontSize: "18px" }}>
                    Monthly $ Saving
                  </div>
                  <div style={{ fontSize: "20px", color: "#1b5e20" }}>
                    ${calculatedResults.monthlySavingMoney}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "#666",
                  }}
                >
                  Enter panel area and monthly bill to see potential savings
                </div>
              )}
            </div>
          )}
        </div>

        {/* Estimated Solar Installation Potential Dropdown */}
        <div style={{ marginBottom: "20px" }}>
          <div
            onClick={toggleInstallation}
            style={{
              background: "#f9a825",
              color: "#222",
              padding: "10px",
              borderRadius: "5px",
              cursor: "pointer",
              marginBottom: "10px",
            }}
          >
            Estimated Solar Installation Potential
          </div>
          {showInstallation && matchedData && (
            <div
              style={{
                background: "#fff",
                padding: "15px",
                borderRadius: "5px",
              }}
            >
              {/* Removed summary header and stats */}
              {/* Charts Section for Installation Potential */}
              <div style={{ marginTop: "30px" }}>
                <div style={{ height: "300px", marginBottom: "30px" }}>
                  <h4 style={{ textAlign: "center" }}>Roof Qualification</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        dataKey="value"
                        data={[
                          {
                            name: "Qualified",
                            value: Number(matchedData.percent_qualified),
                          },
                          {
                            name: "Not Qualified",
                            value: 100 - Number(matchedData.percent_qualified),
                          },
                        ]}
                        outerRadius={85}
                        label={({ name, value }) =>
                          `${name}: ${value.toFixed(2)}%`
                        }
                      >
                        {COLORS.map((color, i) => (
                          <Cell key={i} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ height: "300px" }}>
                  <h4 style={{ textAlign: "center" }}>
                    Total Installation Size by Roof Orientation
                  </h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          name: "Flat",
                          value: (matchedData.yearly_sunlight_kwh_f / 1e6).toFixed(2),
                        },
                        {
                          name: "South",
                          value: (matchedData.yearly_sunlight_kwh_s / 1e6).toFixed(2),
                        },
                        {
                          name: "West",
                          value: (matchedData.yearly_sunlight_kwh_w / 1e6).toFixed(2),
                        },
                        {
                          name: "East",
                          value: (matchedData.yearly_sunlight_kwh_e / 1e6).toFixed(2),
                        },
                        {
                          name: "North",
                          value: (matchedData.yearly_sunlight_kwh_n / 1e6).toFixed(2),
                        },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        label={{
                          value: "Roof Orientation",
                          position: "insideBottom",
                          offset: -5,
                        }}
                      />
                      <YAxis
                        label={{
                          value: "MWh/year",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f9a825" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {matchedData.install_size_kw_buckets_json && (
                  <div
                    style={{
                      width: "100%",
                      height: "300px",
                      paddingBottom: "20px",
                      marginTop: "30px",
                    }}
                  >
                    <h4 style={{ textAlign: "center" }}>
                      Rooftop Solar Capacity Distribution (&lt; 50kW)
                    </h4>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart
                        data={JSON.parse(
                          matchedData.install_size_kw_buckets_json
                        ).map(([bucket, count]) => ({
                          name: `${bucket}–${bucket + 5}`,
                          value: Number(count).toFixed(2),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          label={{
                            value: "Installation Size (kW)",
                            position: "insideBottom",
                            offset: -5,
                          }}
                        />
                        <YAxis
                          label={{
                            value: "Number of Roofs",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <Tooltip />
                        <Bar dataKey="value" fill="#fbc02d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
          {!showInstallation && !matchedData && (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                color: "#666",
              }}
            >
              No installation data available.
            </div>
          )}
        </div>

        {/* Solar Potential Analysis Dropdown */}
        <div style={{ marginBottom: "20px" }}>
          <div
            onClick={toggleAnalysis}
            style={{
              background: "#8e24aa",
              color: "#fff",
              padding: "10px",
              borderRadius: "5px",
              cursor: "pointer",
              marginBottom: "10px",
            }}
          >
            Solar Potential Analysis
          </div>
          {showAnalysis && (
            <div
              style={{
                background: "#fff",
                padding: "15px",
                borderRadius: "5px",
                marginBottom: "20px",
              }}
            >
              {/* Analysis Input Fields */}
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontWeight: "900" }}>
                  Average Monthly Energy Bill ($):
                </label>
                <input
                  type="number"
                  min="0"
                  value={analysisMonthlyBill}
                  onChange={handleAnalysisMonthlyBillChange}
                  placeholder="Enter monthly bill"
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "16px",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                    marginTop: "5px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontWeight: "900" }}>Energy Cost per kWh ($):</label>
                <input
                  type="number"
                  min="0"
                  value={energyCostPerKWh}
                  onChange={handleEnergyCostChange}
                  placeholder="Enter cost per kWh"
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "16px",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                    marginTop: "5px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontWeight: "900" }}>
                  Solar Incentives (% discount):
                </label>
                <input
                  type="number"
                  min="0"
                  value={solarIncentives}
                  onChange={handleSolarIncentivesChange}
                  placeholder="Enter incentive percentage"
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "16px",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                    marginTop: "5px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontWeight: "900" }}>
                  Panel Capacity (Watts per panel):
                </label>
                <input
                  type="number"
                  min="0"
                  value={panelCapacityWatts}
                  onChange={handlePanelCapacityChange}
                  placeholder="Enter panel capacity"
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "16px",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                    marginTop: "5px",
                  }}
                />
              </div>
              {/* Sliders for Panel Count and Installation Cost per Watt */}
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontWeight: "900" }}>Panel Count:</label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={panelCount}
                  onChange={handlePanelCountChange}
                  style={{ width: "100%" }}
                />
                <div style={{ textAlign: "center" }}>{panelCount}</div>
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontWeight: "900" }}>
                  Installation Cost per Watt ($):
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.1"
                  value={installationCostPerWatt}
                  onChange={handleInstallationCostChange}
                  style={{ width: "100%" }}
                />
                <div style={{ textAlign: "center" }}>
                  {installationCostPerWatt.toFixed(2)}
                </div>
              </div>

              {/* Display Analysis Results */}
              <div style={{ marginBottom: "15px", textAlign: "center" }}>
                <p>
                  <strong>Yearly Energy Production:</strong>{" "}
                  {yearlyProduction.toFixed(2)} kWh
                </p>
                <p>
                  <strong>Total Capacity:</strong> {totalCapacityWatts} W
                </p>
                <p>
                  <strong>Installation Cost (after incentives):</strong> $
                  {netInstallationCost.toFixed(2)}
                </p>
                <p>
                  <strong>Energy Covered:</strong>{" "}
                  {(energyCoveredFraction * 100).toFixed(2)}%
                </p>
                <p>
                  <strong>Break Even Year:</strong>{" "}
                  {breakEvenYear !== null ? breakEvenYear : "Not within 20 years"}
                </p>
              </div>

              {/* Line Graph for 20-Year Cost Analysis */}
              <div style={{ height: "300px" }}>
                <h4 style={{ textAlign: "center" }}>20-Year Cost Analysis</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysisData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="year"
                      label={{ value: "Years", position: "insideBottom", offset: -5 }}
                    />
                    <YAxis
                      label={{
                        value: "Cost ($)",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                    <Line
                      type="monotone"
                      dataKey="costWithoutSolar"
                      stroke="#d32f2f"
                      name="Cost without Solar"
                    />
                    <Line
                      type="monotone"
                      dataKey="costWithSolar"
                      stroke="#388e3c"
                      name="Cost with Solar"
                    />
                    <Line
                      type="monotone"
                      dataKey="savings"
                      stroke="#1976d2"
                      name="Savings"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapComponent;