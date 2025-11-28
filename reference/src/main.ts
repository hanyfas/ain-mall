import { getMapData, show3dMap, disableText3DWorker } from '@mappedin/mappedin-js';
import type { Floor, MapView, TShow3DMapOptions } from '@mappedin/mappedin-js';
import theme from './theme';
import { applyThemeStyling } from './themeApplicator';
import svgIcons from './assets/svgicons.js';

const options = {
    key: 'mik_7e6tcm2wtODeksRHr54e207b6',
    secret: 'mis_5yBUdX4rFxFAkJgWzXqenV4Lasx4wK4QhOMarlQQuRk939a10d2',
    mapId: '68d783a6dbd109000b017234'
};

function createFloorSelector(mapView: MapView, floors: Floor[]) {
    const floorSelector = document.getElementById('floor-selector');

    if (!floorSelector) return;

    // Clear existing buttons
    floorSelector.innerHTML = '';

    // Sort floors by elevation (highest to lowest)
    const sortedFloors = [...floors].sort((a, b) => b.elevation - a.elevation);

    // Create floor buttons
    sortedFloors.forEach((floor) => {
        const button = document.createElement('button');
        button.className = 'floor-button';
        button.textContent = floor.name || floor.shortName || `L${floor.elevation}`;
        button.dataset.floorId = floor.id;

        // Mark current floor as active
        if (floor.id === mapView.currentFloor.id) {
            button.classList.add('active');
        }

        // Add click handler to switch floors
        button.addEventListener('click', () => {
            mapView.setFloor(floor.id);
        });

        floorSelector.appendChild(button);
    });

    // Listen for floor changes to update active state
    mapView.on('floor-change', (event) => {
        const buttons = floorSelector.querySelectorAll('.floor-button');
        buttons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-floor-id') === event.floor.id) {
                btn.classList.add('active');
            }
        });
    });
}

async function init() {
    const mapData = await getMapData(options);

    const MapOptions: TShow3DMapOptions = {
        //initialFloor: initialFloor,
        outdoorView: {
            enabled: false,
        },
        style: {
            //backgroundAlpha: number,
            backgroundColor: '#444444',
            outlines: true,
            shading: true,
            //wallTopColor: '#ff00ff',
        },
    };


    const mapView = await show3dMap(
        document.getElementById('mappedin-map') as HTMLDivElement,
        mapData, MapOptions
    );


    // Label all spaces
    mapView.Text3D.labelAll();

    // Get all floors from the API and create floor selector
    const floors = mapData.getByType('floor');
    createFloorSelector(mapView, floors);


    let labelIcon = '';
    mapData.getByType("space").forEach((space) => {
        if (space.type == 'hallway') {
            mapView.updateState(space, {
                color: "#666666", // Set height for the space
            });
        }
        else if (space.type == 'room' && space.name.trim() != '') {
            if (space.name.toLowerCase().includes("prayer")) {
                labelIcon = svgIcons.prayer_room_mf;
            }
            else if (space.name.toLowerCase().includes("toilet")) {
                labelIcon = svgIcons.toilet_mf;
            }
            else {
                labelIcon = '';
            }
            mapView.Labels.add(space, space.name, {
                appearance: {
                    //pinColor: color,
                    //pinColorInactive: color,
                    icon: labelIcon,
                    iconSize: 30,
                    color: "#101010",
                    textSize: 15,
                },
            });

        }
    });


    mapData.getByType("connection").forEach((connection) => {
        const connectionType = connection.type;
        if (connectionType == 'elevator') {
            connection.coordinates.forEach((c) => {
                mapView.Labels.add(c, '', {
                    appearance: {
                        pinColor: '#FFFFFF',
                        pinColorInactive: '#FFFFFF',
                        icon: svgIcons.elevators,
                        iconSize: 30,
                        color: "#101010",
                        textSize: 15,
                    },
                });
            });
        }
        else {
            connection.coordinates.forEach((c) => {
                mapView.Labels.add(c, '', {
                    appearance: {
                        pinColor: '#FFFFFF',
                        pinColorInactive: '#FFFFFF',
                        icon: svgIcons.escalator,
                        iconSize: 30,
                        color: "#101010",
                        textSize: 15,
                    },
                });
            });

        }
    });

    applyThemeStyling(mapView, mapData, theme);
}

init();