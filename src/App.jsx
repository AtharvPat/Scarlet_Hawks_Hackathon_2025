import React from "react";
import MapComponent from "./components/MapComponent"; // Import MapComponent

function App() {
  return (
    <div>
<h1>
  <span
    style={{
      marginLeft: "20px",
      background: "linear-gradient(to right, #FFD700, #800080)",
      WebkitBackgroundClip: "text",
      color: "transparent",
    }}
  >
    SunWise
  </span>{" "}
  <span style={{ fontSize: "0.5em", verticalAlign: "baseline" }}>
    by Import Pandas
  </span>
</h1>
      <MapComponent /> {/* Display the map here */}
    </div>
  );
}

export default App;
