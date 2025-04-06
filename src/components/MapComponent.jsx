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
} from "recharts";

const COLORS = ["#0088FE", "#FF8042"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MapComponent = () => {
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [solarData, setSolarData] = useState([]);
  const [matchedData, setMatchedData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("May");
  const [predictionResult, setPredictionResult] = useState(null);
  
  // New state variables for calculator
  const [panelArea, setPanelArea] = useState(25); // Default values to make testing easier
  const [monthlyBill, setMonthlyBill] = useState(150); // Default values to make testing easier
  const [calculatedResults, setCalculatedResults] = useState({
    annualEnergy: 0,
    carbonOffset: 0,
    treeEquivalent: 0,
    monthlySavingKWh: 0,
    monthlySavingMoney: 0,
  });

  const autocompleteRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "Add your API key here",
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

  // New effect to calculate results whenever panel area, monthly bill or prediction result changes
  useEffect(() => {
    // Default prediction value if none available yet (for testing visibility)
    const solarEnergyValue = predictionResult || 4.5; // Average value of 4.5 kWh/m² as fallback
    
    if (panelArea > 0 && monthlyBill > 0) {
      // Assume average electricity rate of $0.15 per kWh
      const electricityRate = 0.15;
      
      // Calculate monthly kWh usage from bill
      const monthlyUsage = monthlyBill / electricityRate;
      
      // Calculate annual energy production based on panel area and predicted solar energy
      const annualEnergy = panelArea * solarEnergyValue * 365;
      
      // Carbon offset calculation (0.85 lbs CO2 per kWh)
      const carbonOffset = (annualEnergy * 0.85) / 2000; // Convert to tons
      
      // Tree equivalent (1 tree absorbs about 48 lbs of CO2 per year)
      const treeEquivalent = Math.round((carbonOffset * 2000) / 48);
      
      // Monthly energy saving in kWh (capped at monthly usage)
      const monthlySavingKWh = Math.min(annualEnergy / 12, monthlyUsage);
      
      // Monthly money saving
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

      const { sin, cos } = getMonthFeatures(selectedMonth || "May");

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
        coordinates: {
          lat,
          lng,
        },
      });

      setMarkerPosition({ lat, lng });

      const match = solarData.find(
        (entry) =>
          entry.region_name?.toLowerCase() === regionName?.toLowerCase()
      );
      setMatchedData(match || null);
    }
  };

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);

    // Re-trigger prediction if a place is already selected
    if (selectedPlace) {
      const { lat, lng } = selectedPlace.coordinates;
      const { sin, cos } = getMonthFeatures(newMonth);
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

  // Handlers for new input fields
  const handlePanelAreaChange = (e) => {
    setPanelArea(parseFloat(e.target.value) || 0);
  };

  const handleMonthlyBillChange = (e) => {
    setMonthlyBill(parseFloat(e.target.value) || 0);
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div
      style={{
        height: "auto", // Changed from conditional to always be auto
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: "70vh", // Fixed height for map
          position: "relative",
        }}
      >
        <GoogleMap
          center={markerPosition || { lat: 41.8781, lng: -87.6298 }}
          zoom={19}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          mapTypeId="satellite"
          options={{
            tilt: 0, // Ensures map is in top-down (2D) view
            heading: 0, // Ensures no rotation
            disableDefaultUI: false,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
          }}
        >
          {markerPosition && <Marker position={markerPosition} />}
        </GoogleMap>

        <div
          style={{
            position: "absolute",
            top: "80px",
            left: "80px",
            zIndex: 10,
            display: "flex",
            gap: "12px",
          }}
        >
          <Autocomplete
            onLoad={(auto) => (autocompleteRef.current = auto)}
            onPlaceChanged={handlePlaceChanged}
          >
            <input
              type="text"
              placeholder="Search for a place"
              style={{
                width: "300px",
                padding: "10px",
                fontSize: "16px",
                borderRadius: "5px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
              }}
            />
          </Autocomplete>

          <select
            value={selectedMonth}
            onChange={handleMonthChange}
            style={{
              padding: "10px",
              fontSize: "16px",
              borderRadius: "5px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            }}
          >
            {MONTHS.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>

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
      </div>

      {/* New Solar Calculator Card - ALWAYS VISIBLE */}
      <div style={{ background: "#f5f5f5", color: "#222", padding: "30px", marginBottom: "40px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center", marginBottom: "30px" }}>
          Personal Solar Calculator
        </h2>
        
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "20px", marginBottom: "40px" }}>
          <div style={{ display: "flex", flexDirection: "column", width: "300px" }}>
            <label style={{ marginBottom: "8px", fontWeight: "500" }}>Panel Area (m²):</label>
            <input
              type="number"
              min="0"
              value={panelArea || ""}
              onChange={handlePanelAreaChange}
              placeholder="Enter panel area"
              style={{
                padding: "12px",
                fontSize: "16px",
                borderRadius: "5px",
                border: "1px solid #ddd",
              }}
            />
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", width: "300px" }}>
            <label style={{ marginBottom: "8px", fontWeight: "500" }}>Monthly Electricity Bill ($):</label>
            <input
              type="number"
              min="0"
              value={monthlyBill || ""}
              onChange={handleMonthlyBillChange}
              placeholder="Enter monthly bill"
              style={{
                padding: "12px",
                fontSize: "16px",
                borderRadius: "5px",
                border: "1px solid #ddd",
              }}
            />
          </div>
        </div>
        
        {panelArea > 0 && monthlyBill > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-around", marginTop: "20px" }}>
            <div style={{ textAlign: "center", margin: "15px", minWidth: "180px" }}>
              <div style={{ fontSize: "40px" }}>⚡</div>
              <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "5px" }}>Annual Energy</div>
              <div style={{ fontSize: "20px", color: "#0277bd" }}>{calculatedResults.annualEnergy} kWh</div>
            </div>
            
            <div style={{ textAlign: "center", margin: "15px", minWidth: "180px" }}>
              <div style={{ fontSize: "40px" }}>🌱</div>
              <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "5px" }}>Carbon Offset</div>
              <div style={{ fontSize: "20px", color: "#2e7d32" }}>{calculatedResults.carbonOffset} tons</div>
            </div>
            
            <div style={{ textAlign: "center", margin: "15px", minWidth: "180px" }}>
              <div style={{ fontSize: "40px" }}>🌳</div>
              <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "5px" }}>Tree Equivalent</div>
              <div style={{ fontSize: "20px", color: "#33691e" }}>{calculatedResults.treeEquivalent} trees</div>
            </div>
            
            <div style={{ textAlign: "center", margin: "15px", minWidth: "180px" }}>
              <div style={{ fontSize: "40px" }}>⚙️</div>
              <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "5px" }}>Monthly Saving</div>
              <div style={{ fontSize: "20px", color: "#01579b" }}>{calculatedResults.monthlySavingKWh} kWh</div>
            </div>
            
            <div style={{ textAlign: "center", margin: "15px", minWidth: "180px" }}>
              <div style={{ fontSize: "40px" }}>💰</div>
              <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "5px" }}>Monthly $ Saving</div>
              <div style={{ fontSize: "20px", color: "#1b5e20" }}>${calculatedResults.monthlySavingMoney}</div>
            </div>
          </div>
        )}
        
        {!(panelArea > 0 && monthlyBill > 0) && (
          <div style={{ textAlign: "center", padding: "30px", color: "#666" }}>
            Enter panel area and monthly bill to see your potential savings
          </div>
        )}
        
      </div>

      {/* Visualization Section */}
      {matchedData && (
        <div style={{ background: "#f9f9f9", color: "#222", padding: "20px" }}>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            Estimated Solar Installation Potential
          </h2>

          {/* Summary Stats with Icons */}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              marginTop: "20px",
            }}
          >
            {/* Left Column */}

            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "48px" }}>✅</div>

                <div>
                  <strong>Qualified Roofs</strong>
                  <br />
                  {Number(matchedData.percent_qualified).toFixed(2)}%
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "48px" }}>🏠</div>

                <div>
                  <strong>Total Roofs</strong>

                  <br />

                  {Number(matchedData.count_qualified).toLocaleString()}
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "48px" }}>📐</div>

                <div>
                  <strong>Roof Space</strong>
                  <br />
                  {(matchedData.total_area_sqft / 1e6).toFixed(2)}M sq ft
                </div>
              </div>
            </div>

            {/* Right Column */}

            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "48px" }}>⚡</div>

                <div>
                  <strong>Capacity</strong>
                  <br />
                  {(matchedData.kw_total / 1000).toFixed(2)} MW DC
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "48px" }}>🔌</div>

                <div>
                  <strong>Electricity</strong>
                  <br />
                  {(matchedData.yearly_sunlight_kwh_total / 1000).toFixed(
                    2
                  )}{" "}
                  MWh/yr
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "48px" }}>🌱</div>

                <div>
                  <strong>Carbon Offset</strong>
                  <br />
                  {Number(matchedData.carbon_offset_metric_tons).toFixed(
                    2
                  )}{" "}
                  metric tons
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              marginTop: "60px",
              gap: "40px",
            }}
          >
            {/* Pie Chart */}

            <div style={{ flex: 1, minWidth: "300px", height: "300px" }}>
              <h4 style={{ textAlign: "center" }}>Roof Qualification</h4>

              <ResponsiveContainer width="100%" height="100%">
                {" "}
                <PieChart>
                  {" "}
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
                    label={({ name, value }) => `${name}: ${value.toFixed(2)}%`}
                  >
                    {" "}
                    {COLORS.map((color, i) => (
                      <Cell key={i} fill={color} />
                    ))}{" "}
                  </Pie>{" "}
                  <Tooltip
                    formatter={(value) => `${Number(value).toFixed(2)}%`}
                  />{" "}
                </PieChart>{" "}
              </ResponsiveContainer>
            </div>

            {/* Orientation Bar Chart */}

            <div style={{ flex: 1, minWidth: "300px", height: "300px" }}>
              <h4 style={{ textAlign: "center" }}>
                Total Installation Size by Roof Orientation
              </h4>

              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: "Flat",

                      value: (matchedData.yearly_sunlight_kwh_f / 1e6).toFixed(
                        2
                      ),
                    },

                    {
                      name: "South",

                      value: (matchedData.yearly_sunlight_kwh_s / 1e6).toFixed(
                        2
                      ),
                    },

                    {
                      name: "West",

                      value: (matchedData.yearly_sunlight_kwh_w / 1e6).toFixed(
                        2
                      ),
                    },

                    {
                      name: "East",

                      value: (matchedData.yearly_sunlight_kwh_e / 1e6).toFixed(
                        2
                      ),
                    },

                    {
                      name: "North",

                      value: (matchedData.yearly_sunlight_kwh_n / 1e6).toFixed(
                        2
                      ),
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

            {/* Install Size Histogram */}

            {matchedData.install_size_kw_buckets_json && (
              <div
                style={{
                  width: "100%",

                  height: "300px",

                  paddingBottom: "20px",

                  marginTop: "60px",
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
    </div>
  );
};

export default MapComponent;