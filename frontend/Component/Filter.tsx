import { useState } from "react";

type FilterProps = {
  REGION_OPTIONS: string[];
  CITY_OPTIONS: string[];
};

export default function Filter({ REGION_OPTIONS, CITY_OPTIONS }: FilterProps) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<"region" | "city" | null>(
    null,
  );

  function toggleDropdown(name: "region" | "city") {
    setOpenDropdown((curr) => (curr === name ? null : name));
  }
  return (
    <>
      <div className="Filter">
        {/* REGION */}
        <button
          onClick={() => toggleDropdown?.("region")}
          className="Filter-btn"
        >
          {selectedRegion ? `Region: ${selectedRegion}` : "Filter Region"}
        </button>
        <div
          className={`Filter-content ${openDropdown === "region" ? "show" : ""}`}
        >
          {REGION_OPTIONS.map((r) => (
            <button
              key={r}
              className="Filter-item"
              onClick={() => {
                setSelectedRegion(r);
                setOpenDropdown(null);
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* CITY */}
        <button onClick={() => toggleDropdown?.("city")} className="Filter-btn">
          {selectedCity ? `City: ${selectedCity}` : "Filter City"}
        </button>
        <div
          className={`Filter-content ${openDropdown === "city" ? "show" : ""}`}
        >
          {CITY_OPTIONS.map((c) => (
            <button
              key={c}
              className="Filter-item"
              onClick={() => {
                setSelectedCity(c);
                setOpenDropdown(null);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
