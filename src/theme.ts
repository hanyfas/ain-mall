// Theme configuration for Mappedin SDK
const theme = {
  "name": "honeycrisp",
  "showEntrances": false,
  "wallHeights": {
    "interior": 1,
    "exterior": 1.1
  },
  "roomHeights": {
    "standard": 0.1,
    "hallway": 0.1,
    "connection": 0.1,
    "bathroom": 0.1,
    "inaccessible": 0.1
  },
  "objectHeight": 0.5,
  "opacity": {
    "standard": 100,
    "inaccessible": 100,
    "bathroom": 100,
    "hallway": 100,
    "connection": 100,
    "interiorWall": 100,
    "exteriorWall": 100,
    "desk": 100,
    "doors": 100
  },
  "colors": {
    "accent": {
      "primary": "#6A9FA0",
      "secondary": "#C9C8C7",
      "neutral": "#D0CDCC",
      "neutral2": "#E3E2E1",
      "success": "#66A15B",
      "error": "#C47947"
    },
    "background": {
      "primary": "#FBFAF9",
      "secondary": "#F5F1EF",
      "tertiary": "#E9F9F9"
    },
    "text": {
      "secondary": "#6A9FA0",
      "tertiary": "#7E7D7D",
      "quaternary": "#6A9FA0",
      "error": "#C47947",
      "highlight": "#65ADAE",
      "link": "#6A9FA0"
    },
    "map": {
      "labels": {
        "default": "#695D49",
        "defaultOutline": "#FFFFFF",
        "connection": "#338E92",
        "connectionOutline": "#FFFFFF",
        "washroom": "#4074BD",
        "washroomOutline": "#FFFFFF",
        "parking": "#4D933C",
        "parkingOutline": "#FFFFFF",
        "point": "#9D4CA6",
        "pointOutline": "#FFFFFF",
        "door": "#B0653B",
        "doorOutline": "#FFFFFF"
      },
      "markers": {
        "default": "#515151",
        "parachute": "#DA7537",
        "highlight": "#9D4CA6",
        "departure": "#5C93E1",
        "destination": "#9D4CA6",
        "youAreHere": "#BE5050"
      },
      "geometry": {
        "wallTops": "#909898",
        "hover": "#DBC8D4",
        "highlight": "#C8A8C5"
      },
      "path": "#5C93E1"
    },
    "rooms": {
      "standard": "#EEECE7",
      "inaccessible": "#D8D5CB",
      "bathroom": "#D7E5EC",
      "hallway": "#F8F7F3",
      "connection": "#EEECE7",
      "wall": "#FFFFFF",
      "desk": "#C9C7C2"
    }
  },
  "outdoorStyle": "/honeycrisp.json"
};

export default theme;
export const colors = theme.colors;

