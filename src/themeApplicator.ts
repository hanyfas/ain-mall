import { WALLS, DOORS } from "@mappedin/mappedin-js";

// Helper function to check if a point is inside a polygon
function isPointInPolygon(point: any, polygon: any): boolean {
  try {
    // Handle different polygon formats
    let coordinates: number[][];

    if (polygon.coordinates && polygon.coordinates[0]) {
      // GeoJSON format
      coordinates = polygon.coordinates[0];
    } else if (
      Array.isArray(polygon) &&
      polygon[0] &&
      Array.isArray(polygon[0])
    ) {
      // Direct coordinate array format
      coordinates = polygon;
    } else {
      return false;
    }

    const x = point.longitude;
    const y = point.latitude;
    let inside = false;

    for (
      let i = 0, j = coordinates.length - 1;
      i < coordinates.length;
      j = i++
    ) {
      const xi = coordinates[i][0];
      const yi = coordinates[i][1];
      const xj = coordinates[j][0];
      const yj = coordinates[j][1];

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }

    return inside;
  } catch (error) {
    return false;
  }
}

// Helper function to determine if a space is a connection room
function isConnectionRoom(
  space: any,
  mapData: any,
  isBathroom: boolean,
  isHallway: boolean
): boolean {
  // Skip rooms that are already categorized as bathrooms or hallways
  if (isBathroom || isHallway) return false;

  // Check if this room actually contains connection points (stairs, elevators)
  const containsConnectionPoint = (() => {
    try {
      // Get all connections on this floor
      const connections = mapData.getByType("connection");
      const floorConnections = connections.filter(
        (connection: any) =>
          connection.coordinates &&
          connection.coordinates.some(
            (coord: any) => coord.floorId === space.floor.id
          )
      );

      // Check if any connection point is within this space's polygon
      for (const connection of floorConnections) {
        const connectionCoord = connection.coordinates.find(
          (coord: any) => coord.floorId === space.floor.id
        );
        if (
          connectionCoord &&
          connectionCoord.latitude &&
          connectionCoord.longitude
        ) {
          // Get the space geometry from geoJSON
          const spaceGeometry = space.geoJSON?.geometry;
          if (spaceGeometry) {
            // Simple point-in-polygon check using the space's geoJSON geometry
            if (isPointInPolygon(connectionCoord, spaceGeometry)) {
              return true;
            }
          }
        }
      }
      return false;
    } catch (error) {
      // If there's an error accessing connections, fall back to other checks
      return false;
    }
  })();

  // Fallback: Check if room name suggests it's a connection point
  const hasConnectionName =
    space.name &&
    (space.name.toLowerCase().includes("elevator") ||
      space.name.toLowerCase().includes("stair") ||
      space.name.toLowerCase().includes("stairs") ||
      space.name.toLowerCase().includes("escalator"));

  return containsConnectionPoint || hasConnectionName;
}

/**
 * Apply theme styling to a Mappedin map
 * Note: This function selectively applies theme properties, excluding text and markers
 * @param mapView - The Mappedin MapView instance
 * @param mapData - The Mappedin MapData instance
 * @param theme - The theme configuration object
 */
export function applyThemeStyling(mapView: any, mapData: any, theme: any) {
  // Set background color using CSS
  const mapContainer = document.getElementById("mappedin-map");
  if (mapContainer && theme.colors.map.background) {
    mapContainer.style.backgroundColor = theme.colors.map.background;
  }

  // Set wall colors and heights
  const interiorWallColor =
    theme.colors.rooms.interiorWall || theme.colors.rooms.wall;
  const exteriorWallColor =
    theme.colors.rooms.exteriorWall || theme.colors.rooms.wall;

  const interiorWallState: any = {
    color: interiorWallColor,
    topColor: theme.colors.map.geometry.wallTops,
    opacity: theme.opacity?.interiorWall
      ? theme.opacity.interiorWall / 100
      : 1.0,
    visible: true,
  };

  const exteriorWallState: any = {
    color: exteriorWallColor,
    topColor: theme.colors.map.geometry.wallTops,
    opacity: theme.opacity?.exteriorWall
      ? theme.opacity.exteriorWall / 100
      : 1.0,
    visible: true,
  };

  // Apply wall heights if defined
  if (theme.wallHeights?.interior !== undefined) {
    interiorWallState.height = theme.wallHeights.interior;
  }

  if (theme.wallHeights?.exterior !== undefined) {
    exteriorWallState.height = theme.wallHeights.exterior;
  }

  mapView.updateState(WALLS.Interior, interiorWallState);
  mapView.updateState(WALLS.Exterior, exteriorWallState);

  // Apply object height and opacity to all objects
  mapData.getByType("object").forEach((object: any) => {
    const updateState: any = {
      color: theme.colors.rooms.desk,
      interactive: true,
      hoverColor: theme.colors.map.geometry.hover,
      highlightColor: theme.colors.map.geometry.highlight,
      outline: true,
    };

    // Apply object height
    if (theme.objectHeight !== undefined) {
      updateState.height = theme.objectHeight;
    }

    // Apply object opacity
    if (theme.opacity?.desk !== undefined) {
      updateState.opacity = theme.opacity.desk / 100;
    } else {
      updateState.opacity = 1.0;
    }

    mapView.updateState(object, updateState);
  });

  // Set entrance (doors) color, visibility, and height
  const interiorDoorState: any = {
    color: theme.colors.rooms.doors || "#40A9FF",
    visible: theme.showEntrances || false,
    opacity: theme.opacity?.doors ? theme.opacity.doors / 100 : 0.8,
  };

  const exteriorDoorState: any = {
    color: theme.colors.rooms.doors || "#40A9FF",
    visible: theme.showEntrances || false,
    opacity: theme.opacity?.doors ? theme.opacity.doors / 100 : 0.8,
  };

  // Set door height to match interior wall height if specified
  if (theme.wallHeights?.interior !== undefined) {
    interiorDoorState.height = theme.wallHeights.interior;
    exteriorDoorState.height = theme.wallHeights.interior;
  }

  mapView.updateState(DOORS.Interior, interiorDoorState);
  mapView.updateState(DOORS.Exterior, exteriorDoorState);

  // Get all spaces and identify those without doors
  const spaces = mapData.getByType("space");
  const spacesWithoutDoors = spaces.filter(
    (space: any) => space.doors && space.doors.length === 0
  );
  const roomsWithoutDoors = new Set(
    spacesWithoutDoors.map((space: any) => space.id)
  );

  // Apply special styling to rooms based on their type
  mapData.getByType("space").forEach((space: any) => {
    // Default room styling
    let roomColor = theme.colors.rooms.standard;

    // Check if the space is a bathroom
    const isBathroom =
      space.name &&
      (space.name.toLowerCase().includes("bathroom") ||
        space.name.toLowerCase().includes("washroom") ||
        space.name.toLowerCase().includes("restroom") ||
        space.name.toLowerCase().includes("toilet") ||
        space.name.toLowerCase().includes("wc"));

    // Check if the room is a hallway based on type or name
    const isHallway =
      space.type === "hallway" ||
      (space.name &&
        (space.name.toLowerCase().includes("hallway") ||
          space.name.toLowerCase().includes("corridor") ||
          space.name.toLowerCase().includes("passage") ||
          space.name.toLowerCase().includes("hall")));

    // Check if the room is a connection room
    const isConnection = isConnectionRoom(
      space,
      mapData,
      isBathroom,
      isHallway
    );

    // Check if the room is inaccessible
    const isInaccessible = (() => {
      if (isBathroom || isHallway || isConnection) return false;
      return roomsWithoutDoors.has(space.id);
    })();

    // Apply the appropriate color based on room type
    if (isBathroom) {
      roomColor = theme.colors.rooms.bathroom;
    } else if (isHallway) {
      roomColor = theme.colors.rooms.hallway;
    } else if (isConnection) {
      roomColor = theme.colors.rooms.connection;
    } else if (isInaccessible) {
      roomColor = theme.colors.rooms.inaccessible;
    }

    // Determine the appropriate height based on room type
    let heightToApply = undefined;
    let shouldResetHeight = false;

    if (theme.roomHeights) {
      // Theme has room height settings, apply them
      if (isBathroom && theme.roomHeights?.bathroom !== undefined) {
        heightToApply = theme.roomHeights.bathroom;
      } else if (isHallway && theme.roomHeights?.hallway !== undefined) {
        heightToApply = theme.roomHeights.hallway;
      } else if (isConnection && theme.roomHeights?.connection !== undefined) {
        heightToApply = theme.roomHeights.connection;
      } else if (
        isInaccessible &&
        theme.roomHeights?.inaccessible !== undefined
      ) {
        heightToApply = theme.roomHeights.inaccessible;
      } else if (theme.roomHeights?.standard !== undefined) {
        heightToApply = theme.roomHeights.standard;
      }
    } else {
      // Theme doesn't have room height settings, reset to Mappedin JS defaults
      shouldResetHeight = true;
    }

    // Apply the color, interactive properties, and height
    const updateState: any = {
      color: roomColor,
      interactive: true,
      hoverColor: theme.colors.map.geometry.hover,
      highlightColor: theme.colors.map.geometry.highlight,
    };

    // Add height if specified, or ensure it's reset to Mappedin JS default
    if (heightToApply !== undefined) {
      updateState.height = heightToApply;
    } else if (shouldResetHeight) {
      // For themes without height settings, explicitly remove height to reset to Mappedin JS default
      // In RC.3, we need to be careful with readonly state - create a new object without height
      const currentState = mapView.getState(space);
      const newState = {
        ...updateState,
        // Copy any existing properties from current state except height
        ...(currentState.visible !== undefined && {
          visible: currentState.visible,
        }),
        ...(currentState.opacity !== undefined && {
          opacity: currentState.opacity,
        }),
        // Explicitly don't include height to reset to Mappedin JS default
      };
      mapView.updateState(space, newState);
      return; // Skip the normal updateState call below
    }

    // Apply opacity based on room type
    if (isBathroom && theme.opacity?.bathroom !== undefined) {
      updateState.opacity = theme.opacity.bathroom / 100;
    } else if (isHallway && theme.opacity?.hallway !== undefined) {
      updateState.opacity = theme.opacity.hallway / 100;
    } else if (isConnection && theme.opacity?.connection !== undefined) {
      updateState.opacity = theme.opacity.connection / 100;
    } else if (isInaccessible && theme.opacity?.inaccessible !== undefined) {
      updateState.opacity = theme.opacity.inaccessible / 100;
    } else if (theme.opacity?.standard !== undefined) {
      updateState.opacity = theme.opacity.standard / 100;
    }

    mapView.updateState(space, updateState);
  });
}

