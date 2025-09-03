import React from "react";
import { useState } from "react";


type PopupUIProps = {
    onAddGeometry: (type: "point" | "line" | "polygon") => void;
    onEdit: () => void;
  };
  
  export function PopupUI({ onAddGeometry, onEdit }: PopupUIProps) {
    const [mode, setMode] = useState<"main" | "choose">("main");
  
    if (mode === "main") {
      return (
        <div className="popup-choice">
          <button onClick={() => setMode("choose")}>Add Geometry</button>
          <button onClick={onEdit}>Add To Edit</button>
        </div>
      );
    }
  
    return (
      <div className="popup-choice">
        <button onClick={() => onAddGeometry("point")}>Point</button>
        <button onClick={() => onAddGeometry("line")}>Line</button>
        <button onClick={() => onAddGeometry("polygon")}>Polygon</button>
        <button onClick={() => setMode("main")}>Back</button>
      </div>
    );
  }