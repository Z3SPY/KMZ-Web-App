import React, { ChangeEvent, useEffect, useMemo } from "react";
import { useState } from "react";

type FilterProps = {
  REGION_OPTIONS: string[];
  CITY_OPTIONS: string[];
  onChange?: (f: { region: string | null; city: string | null; q: string }) => void;
};

const withAll = (arr: string[], label = "ALL") =>
  arr.length && arr[0] === label ? arr : [label, ...arr];

export default function Filter({ REGION_OPTIONS, CITY_OPTIONS, onChange }: FilterProps) {
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [q, setQ] = useState<string>("");        

  const [openDropdown, setOpenDropdown] = useState<"region" | "city" | null>(null);

  const regionForFilter = useMemo(() => withAll(REGION_OPTIONS), [REGION_OPTIONS]);
  const cityForFilter   = useMemo(() => withAll(CITY_OPTIONS),   [CITY_OPTIONS]);


  useEffect(() => {
    onChange?.({
      region: selectedRegion || null,
      city: selectedCity || null,
      q,
    });
  }, [selectedRegion, selectedCity, q, onChange]);

  const onQChange = (e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value);

  return (
    <>
      <div className="Filter">
        {/* REGION */}
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value === "ALL" ? "": e.target.value)}
        > 
          <option value="" disabled>
            City
          </option>
          {regionForFilter.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}

        </select>

        {/* CITY */}
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value === "ALL" ? "": e.target.value)}
        > 
          <option value="" disabled>
            Region
          </option>
          {cityForFilter.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}

        </select>

        <input type="text" id="Search" name="Search" placeholder="Search Name"  value={q} onChange={onQChange} >
        </input>
      </div>
    </>
  );
}
